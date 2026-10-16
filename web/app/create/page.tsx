"use client";

import { tr, trTerm } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Crosshair, ImageIcon, LocateFixed, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { type Address, parseEventLogs } from "viem";
import { usePublicClient } from "wagmi";
import { FilePicker, Stepper, type StepStatus, TxStatus } from "@/components/common";
import { Button, Card, Field, Input, Loading, Notice, PageBody, PageHero, Select, Textarea } from "@/components/ui";
import { RoleGate } from "@/components/wallet";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { reputationBookAbi } from "@/lib/abi/ReputationBook";
import { addresses, CONTRACTS_READY, requireAddresses } from "@/lib/addresses";
import { formatPercent, formatRupiah, formatUsdt, parseUsdtInput, projectedInvestorReturn } from "@/lib/format";
import { uploadFile, uploadJson } from "@/lib/ipfs";
import { useRole } from "@/lib/role";
import { nowSeconds } from "@/lib/time";
import { useTx } from "@/lib/tx";
import type { CampaignMetadata } from "@/lib/types";

const MILESTONES = { names: ["Tanam", "Tumbuh", "Pra-panen"], bps: [4000, 3500, 2500] };
const DURATIONS = [
  { value: 600, label: ["10 menit (untuk demo)", "10 minutes (for demo)"] },
  { value: 3600, label: ["1 jam", "1 hour"] },
  { value: 86_400, label: ["1 hari", "1 day"] },
  { value: 7 * 86_400, label: ["7 hari", "7 days"] },
  { value: 30 * 86_400, label: ["30 hari", "30 days"] },
];

type CostRow = { item: string; usdt: string };

function isoDatePlusDays(days: number) {
  const d = new Date((nowSeconds() + days * 86_400) * 1000);
  return d.toISOString().slice(0, 10);
}

function Section({ n, title, description, children }: { n: number; title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-hutan-900 font-display text-sm font-semibold text-emas-300">{n}</span>
        <div>
          <h2 className="font-display text-xl font-semibold text-hutan-950">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-stone-600">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export default function CreatePage() {
  const { role, address, farmerCooperative } = useRole();
  const client = usePublicClient();
  const router = useRouter();
  const tx = useTx();

  const [commodity, setCommodity] = useState("");
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [locationName, setLocationName] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [landArea, setLandArea] = useState("");
  const [target, setTarget] = useState("");
  const [estimate, setEstimate] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [duration, setDuration] = useState(600);
  const [costPlan, setCostPlan] = useState<CostRow[]>([{ item: "", usdt: "" }]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [coordNote, setCoordNote] = useState<string>("");
  // Asal koordinat: GPS foto boleh menimpa koordinat contoh, tapi tidak menimpa isian manual.
  const [coordSource, setCoordSource] = useState<"none" | "demo" | "photo" | "device" | "manual">("none");
  const [formError, setFormError] = useState<string>("");
  const [phase, setPhase] = useState<"idle" | "photo" | "meta" | "chain" | "done">("idle");

  const names = useQuery({
    queryKey: ["farmerNames", address, farmerCooperative],
    enabled: Boolean(client && address && farmerCooperative && CONTRACTS_READY && role === "petani"),
    queryFn: async () => {
      const { factory, reputationBook } = requireAddresses();
      const [farmerName, cooperativeName, blocked] = await Promise.all([
        client!.readContract({ address: factory, abi: campaignFactoryAbi, functionName: "farmerName", args: [address as Address] }),
        client!.readContract({
          address: factory,
          abi: campaignFactoryAbi,
          functionName: "cooperativeName",
          args: [farmerCooperative as Address],
        }),
        client!.readContract({ address: reputationBook, abi: reputationBookAbi, functionName: "isBlocked", args: [address as Address] }),
      ]);
      return { farmerName, cooperativeName, blocked };
    },
  });

  const previewRef = useRef("");
  useEffect(() => () => URL.revokeObjectURL(previewRef.current), []);

  function selectPhoto(f: File | null) {
    URL.revokeObjectURL(previewRef.current);
    previewRef.current = f ? URL.createObjectURL(f) : "";
    setPreview(previewRef.current);
    setPhoto(f);
    if (f) void coordsFromPhoto(f, false);
  }

  async function coordsFromPhoto(file: File, overwrite: boolean) {
    try {
      const exifr = (await import("exifr")).default;
      const gps = await exifr.gps(file);
      if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
        if (overwrite || coordSource === "none" || coordSource === "demo") {
          setLat(gps.latitude.toFixed(6));
          setLon(gps.longitude.toFixed(6));
          setCoordSource("photo");
          setCoordNote(tr("Koordinat diambil dari GPS foto.", "Coordinates taken from the photo's GPS."));
        }
        return;
      }
      if (overwrite) setCoordNote(tr("Foto ini tidak menyimpan GPS. Isi manual atau pakai lokasi HP.", "This photo has no GPS. Fill it in manually or use your phone's location."));
    } catch {
      if (overwrite) setCoordNote(tr("Data GPS di foto ini tidak terbaca.", "The GPS data in this photo can't be read."));
    }
  }

  function coordsFromDevice() {
    if (!navigator.geolocation) return setCoordNote(tr("Perangkat ini tidak mendukung lokasi.", "This device doesn't support location."));
    setCoordNote(tr("Mengambil lokasi…", "Getting your location…"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
        setCoordSource("device");
        setCoordNote(tr("Koordinat diambil dari lokasi perangkat.", "Coordinates taken from your device's location."));
      },
      () => setCoordNote(tr("Izin lokasi ditolak atau sinyal GPS belum dapat.", "Location permission was denied or there's no GPS signal yet.")),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function fillDemo() {
    setCommodity("Cabai merah");
    setTitle(tr("Modal tanam cabai merah musim hujan 2026", "Red chili crop funding, 2026 rainy season"));
    setStory(
      tr(
        "Pak Darto menanam cabai merah di lahan 0,5 ha di Cikajang, Garut, bersama Koperasi Tani Makmur. Modal musim ini dipakai untuk bibit, pupuk, obat tanaman, dan upah tenaga kerja.",
        "Pak Darto grows red chili on 0.5 ha in Cikajang, Garut, with the Koperasi Tani Makmur cooperative. This season's capital goes to seedlings, fertilizer, crop protection, and labor.",
      ),
    );
    setLocationName("Cikajang, Garut");
    // Koordinat contoh Cikajang (id.wikipedia.org/wiki/Cikajang,_Garut). Tidak menimpa koordinat dari GPS foto.
    if (coordSource === "none") {
      setLat("-7.356436");
      setLon("107.806990");
      setCoordSource("demo");
      setCoordNote(tr("Koordinat contoh: Cikajang, Garut. Ganti kalau kamu pakai foto asli yang ada GPS-nya.", "Sample coordinates: Cikajang, Garut. Replace them if you use a real photo with GPS."));
    }
    setLandArea("5000");
    setTarget(tr("1.000", "1,000"));
    setEstimate(tr("1.650", "1,650"));
    setHarvestDate(isoDatePlusDays(120));
    setDuration(600);
    setCostPlan([
      { item: tr("Bibit", "Seedlings"), usdt: "250" },
      { item: tr("Pupuk & obat tanaman", "Fertilizer & crop protection"), usdt: "400" },
      { item: tr("Upah tenaga kerja", "Labor"), usdt: "350" },
    ]);
  }

  const targetWei = parseUsdtInput(target);
  const estimateWei = parseUsdtInput(estimate);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    tx.reset();
    const latN = Number(lat.replace(",", "."));
    const lonN = Number(lon.replace(",", "."));
    const area = Number(landArea.replace(/\./g, ""));
    const harvestUnix = harvestDate ? Math.floor(new Date(`${harvestDate}T12:00:00+07:00`).getTime() / 1000) : 0;
    const rows = costPlan.filter((r) => r.item.trim());
    const problems: string[] = [];
    if (!commodity.trim()) problems.push("komoditas");
    if (!title.trim()) problems.push("judul");
    if (!locationName.trim()) problems.push(tr("nama lokasi", "location name"));
    if (!Number.isFinite(latN) || Math.abs(latN) > 90 || !lat) problems.push("lintang");
    if (!Number.isFinite(lonN) || Math.abs(lonN) > 180 || !lon) problems.push("bujur");
    if (!Number.isInteger(area) || area <= 0) problems.push(tr("luas lahan (angka bulat dalam m²)", "land area (a whole number in m²)"));
    if (!targetWei || targetWei <= 0n) problems.push(tr("kebutuhan modal", "capital needed"));
    if (!estimateWei || estimateWei <= 0n) problems.push(tr("perkiraan hasil penjualan", "expected sales"));
    if (!harvestUnix || harvestUnix <= nowSeconds()) problems.push(tr("tanggal panen (harus setelah hari ini)", "harvest date (must be after today)"));
    if (!photo) problems.push(tr("foto lahan", "field photo"));
    if (rows.some((r) => parseUsdtInput(r.usdt) === null)) problems.push(tr("angka di rencana biaya", "numbers in the cost plan"));
    if (problems.length) return setFormError(tr(`Masih ada yang perlu dilengkapi: ${problems.join(", ")}.`, `Still missing: ${problems.join(", ")}.`));

    try {
      setPhase("photo");
      const cover = await uploadFile(photo!);
      setPhase("meta");
      const meta: CampaignMetadata = {
        schema: "bagipanen.campaign.v1",
        title: title.trim(),
        story: story.trim(),
        farmerName: names.data?.farmerName ?? "",
        cooperativeName: names.data?.cooperativeName ?? "",
        commodity: commodity.trim(),
        costPlan: rows.map((r) => ({ item: r.item.trim(), usdt: Number(r.usdt.replace(/\./g, "").replace(",", ".")) })),
        coverImageCID: cover.cid,
      };
      const metadata = await uploadJson(meta);
      setPhase("chain");
      const receipt = await tx.write({
        address: addresses.factory!,
        abi: campaignFactoryAbi,
        functionName: "createCampaign",
        args: [
          {
            commodity: commodity.trim(),
            locationName: locationName.trim(),
            latE6: Math.round(latN * 1_000_000),
            lonE6: Math.round(lonN * 1_000_000),
            landAreaM2: area,
            targetAmount: targetWei!,
            estimatedRevenue: estimateWei!,
            fundingDuration: BigInt(duration),
            expectedHarvestDate: BigInt(harvestUnix),
            metadataCID: metadata.cid,
            milestoneNames: MILESTONES.names,
            milestoneBps: MILESTONES.bps,
          },
        ],
      });
      if (!receipt) return setPhase("idle");
      const [created] = parseEventLogs({ abi: campaignFactoryAbi, logs: receipt.logs, eventName: "CampaignCreated" });
      setPhase("done");
      if (created) router.push(`/campaign/${created.args.campaign}`);
    } catch (err) {
      setPhase("idle");
      setFormError(err instanceof Error ? err.message : tr("Filenya gagal diunggah. Coba lagi.", "The file failed to upload. Try again."));
    }
  }

  const hero = (description?: ReactNode, actions?: ReactNode) => (
    <PageHero
      eyebrow={tr("Ajukan proyek tanam", "Propose a crop project")}
      title={tr("Ceritakan lahanmu, biar investor ikut menanam", "Tell us about your field, and let investors grow with you")}
      description={description}
      actions={actions}
    />
  );

  if (!CONTRACTS_READY)
    return (
      <>
        {hero()}
        <PageBody>
          <Notice tone="warn">{tr("Alamat kontrak belum diatur.", "Contract addresses aren't set.")}</Notice>
        </PageBody>
      </>
    );
  if (role === undefined)
    return (
      <>
        {hero()}
        <PageBody>
          <Loading />
        </PageBody>
      </>
    );
  if (role !== "petani")
    return (
      <>
        {hero(tr("Proyek tanam diajukan oleh petani yang sudah didaftarkan koperasinya.", "Crop projects are proposed by farmers registered by their cooperative."))}
        <PageBody>
          <RoleGate need="petani" role={role} />
        </PageBody>
      </>
    );

  const stepStatus = (p: typeof phase, mine: "photo" | "meta" | "chain"): StepStatus => {
    const order = ["photo", "meta", "chain", "done"];
    const cur = order.indexOf(p);
    const idx = order.indexOf(mine);
    if (cur === -1) return "todo";
    return cur > idx ? "done" : cur === idx ? "active" : "todo";
  };
  const busy = phase !== "idle" && phase !== "done";
  const ret = targetWei && estimateWei ? projectedInvestorReturn(targetWei, estimateWei) : null;
  const costSum = costPlan.reduce((s, r) => s + (parseUsdtInput(r.usdt) ?? 0n), 0n);

  return (
    <>
      {hero(
        names.data ? (
          <>
            {names.data.farmerName} · {tr("didampingi", "supported by")} {names.data.cooperativeName}
          </>
        ) : (
          tr("Memuat data petani…", "Loading farmer data…")
        ),
        <Button variant="light" onClick={fillDemo}>
          <Sparkles className="size-4 text-emas-300" aria-hidden /> {tr("Isi contoh data demo", "Fill in demo data")}
        </Button>,
      )}
      <PageBody>
        {names.data?.blocked ? (
          <Notice tone="error">
            {tr(
              "Dompet ini tidak bisa mengajukan proyek baru karena pernah gagal bayar. Catatannya ada di Rapor Petani.",
              "This wallet can't propose new projects because it defaulted before. It's recorded on the farmer report card.",
            )}
          </Notice>
        ) : (
          <form onSubmit={onSubmit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-6">
              <Section n={1} title={tr("Tanaman & cerita", "Crop & story")} description={tr("Bagian ini yang pertama kali dibaca investor.", "This is the first thing investors read.")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={tr("Komoditas", "Crop")} htmlFor="commodity">
                    <Input id="commodity" list="commodities" value={commodity} onChange={(e) => setCommodity(e.target.value)} placeholder="Cabai merah" />
                    <datalist id="commodities">
                      {["Cabai merah", "Padi", "Bawang merah", "Tomat", "Jagung"].map((v) => (
                        <option key={v} value={v} label={trTerm(v)} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label={tr("Judul proyek", "Project title")} htmlFor="title">
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("Modal tanam cabai merah musim hujan", "Red chili crop funding, rainy season")} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field
                      label={tr("Cerita singkat", "Short story")}
                      htmlFor="story"
                      hint={tr("Ceritakan siapa kamu, kondisi lahannya, dan modalnya mau dipakai untuk apa.", "Tell us who you are, what the field is like, and what the capital is for.")}
                    >
                      <Textarea id="story" value={story} onChange={(e) => setStory(e.target.value)} />
                    </Field>
                  </div>
                </div>
              </Section>

              <Section n={2} title={tr("Lahan", "Field")} description={tr("Agen AI akan mencocokkan lokasi foto bukti dengan titik lahan ini.", "The AI agent will match the location of proof photos to this point.")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field
                      label={tr("Foto lahan saat ini", "Current field photo")}
                      htmlFor="photo"
                      hint={tr(
                        "Maksimal 5 MB. Ambil langsung dari galeri kamera supaya data GPS dan tanggalnya tetap ada.",
                        "Max 5 MB. Pick it straight from your camera gallery so the GPS and date data are kept.",
                      )}
                    >
                      <FilePicker id="photo" file={photo} onChange={selectPhoto} label={tr("Pilih foto lahan", "Choose a field photo")} />
                    </Field>
                  </div>
                  <Field label={tr("Nama lokasi", "Location name")} htmlFor="loc">
                    <Input id="loc" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Cikajang, Garut" />
                  </Field>
                  <Field label={tr("Luas lahan (m²)", "Land area (m²)")} htmlFor="area" hint={tr("0,5 ha = 5.000 m²", "0.5 ha = 5,000 m²")}>
                    <Input id="area" inputMode="numeric" value={landArea} onChange={(e) => setLandArea(e.target.value)} placeholder="5000" />
                  </Field>
                  <Field label={tr("Lintang (latitude)", "Latitude")} htmlFor="lat">
                    <Input id="lat" inputMode="decimal" value={lat} onChange={(e) => {
                        setLat(e.target.value);
                        setCoordSource("manual");
                      }} placeholder="-7.2" />
                  </Field>
                  <Field label={tr("Bujur (longitude)", "Longitude")} htmlFor="lon">
                    <Input id="lon" inputMode="decimal" value={lon} onChange={(e) => {
                        setLon(e.target.value);
                        setCoordSource("manual");
                      }} placeholder="107.8" />
                  </Field>
                  <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                    <Button size="sm" variant="secondary" disabled={!photo} onClick={() => photo && coordsFromPhoto(photo, true)}>
                      <Crosshair className="size-4" aria-hidden /> {tr("Ambil dari GPS foto", "Use the photo's GPS")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={coordsFromDevice}>
                      <LocateFixed className="size-4" aria-hidden /> {tr("Pakai lokasi perangkat", "Use device location")}
                    </Button>
                    {coordNote && <span className="text-xs text-stone-600">{coordNote}</span>}
                  </div>
                  <p className="text-xs leading-relaxed text-stone-500 sm:col-span-2">
                    {tr(
                      "Foto bukti nanti harus diambil paling jauh 2 km dari titik ini, jadi isi sesuai lokasi lahan yang sebenarnya.",
                      "Proof photos must later be taken within 2 km of this point, so enter your field's real location.",
                    )}
                  </p>
                </div>
              </Section>

              <Section n={3} title={tr("Pendanaan", "Funding")} description={tr("Dana cair bertahap: tanam 40%, tumbuh 35%, pra-panen 25%.", "Funds are released in stages: planting 40%, growing 35%, pre-harvest 25%.")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label={tr("Butuh modal berapa? (USDT)", "How much capital do you need? (USDT)")}
                    htmlFor="target"
                    hint={targetWei ? `${tr("Sekitar", "About")} ${formatRupiah(targetWei)}` : tr("Pakai koma untuk desimal", "Use a dot for decimals")}
                  >
                    <Input id="target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={tr("1.000", "1,000")} />
                  </Field>
                  <Field
                    label={tr("Perkiraan hasil penjualan (USDT)", "Expected sales (USDT)")}
                    htmlFor="estimate"
                    hint={estimateWei ? `${tr("Sekitar", "About")} ${formatRupiah(estimateWei)}` : undefined}
                  >
                    <Input id="estimate" inputMode="decimal" value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder={tr("1.650", "1,650")} />
                  </Field>
                  <Field label={tr("Perkiraan tanggal panen", "Expected harvest date")} htmlFor="harvest">
                    <Input id="harvest" type="date" min={isoDatePlusDays(1)} value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
                  </Field>
                  <Field label={tr("Lama pendanaan", "Funding period")} htmlFor="duration">
                    <Select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                      {DURATIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {tr(d.label[0], d.label[1])}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </Section>

              <Section n={4} title={tr("Rencana biaya", "Cost plan")} description={tr("Rincian pemakaian modal. Tidak wajib, tapi bikin investor lebih yakin.", "How the capital will be used. Optional, but it gives investors more confidence.")}>
                <div className="flex flex-col gap-2">
                  {costPlan.map((row, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        aria-label={tr(`Pos biaya ${i + 1}`, `Cost item ${i + 1}`)}
                        value={row.item}
                        onChange={(e) => setCostPlan(costPlan.map((r, j) => (j === i ? { ...r, item: e.target.value } : r)))}
                        placeholder={tr("Contoh: Bibit", "e.g. Seedlings")}
                      />
                      <Input
                        aria-label={tr(`Jumlah USDT ${i + 1}`, `USDT amount ${i + 1}`)}
                        className="w-28 sm:w-36"
                        inputMode="decimal"
                        value={row.usdt}
                        onChange={(e) => setCostPlan(costPlan.map((r, j) => (j === i ? { ...r, usdt: e.target.value } : r)))}
                        placeholder="USDT"
                      />
                      <button
                        type="button"
                        aria-label={tr("Hapus baris", "Remove row")}
                        onClick={() => setCostPlan(costPlan.filter((_, j) => j !== i))}
                        className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setCostPlan([...costPlan, { item: "", usdt: "" }])}>
                      <Plus className="size-4" aria-hidden /> {tr("Tambah pos biaya", "Add cost item")}
                    </Button>
                    {targetWei && (
                      <p className="text-xs text-stone-500">
                        {tr(`Total ${formatUsdt(costSum)} dari ${formatUsdt(targetWei)} USDT`, `Total ${formatUsdt(costSum)} of ${formatUsdt(targetWei)} USDT`)}
                      </p>
                    )}
                  </div>
                </div>
              </Section>
            </div>

            {/* -------------------------------------------- Ringkasan & kirim */}
            <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
              <Card className="overflow-hidden p-0 sm:p-0">
                <div className="relative h-40 bg-linear-to-br from-hutan-700 to-hutan-950">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- pratinjau file lokal (blob URL)
                    <img src={preview} alt={tr("Pratinjau foto lahan", "Field photo preview")} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-white/50">
                      <ImageIcon className="size-8" aria-hidden />
                      <span className="text-xs">{tr("Foto lahan muncul di sini", "Your field photo shows up here")}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-4 p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-emas-700 uppercase">{tr("Pratinjau", "Preview")}</p>
                    <p className="mt-1 font-display text-lg leading-snug font-semibold text-hutan-950">{title || tr("Judul proyekmu", "Your project title")}</p>
                    <p className="text-sm text-stone-500">{[trTerm(commodity), locationName].filter(Boolean).join(" · ") || tr("Komoditas · lokasi", "Crop · location")}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-stone-500">{tr("Kebutuhan modal", "Capital needed")}</dt>
                      <dd className="font-semibold text-hutan-950">{targetWei ? `${formatUsdt(targetWei)} USDT` : "–"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500">{tr("Imbal hasil investor", "Investor return")}</dt>
                      <dd className="font-semibold text-hutan-700">{ret === null ? "–" : `${formatPercent(ret)} / ${tr("musim", "season")}`}</dd>
                    </div>
                  </dl>
                  {targetWei && (
                    <ul className="flex flex-col gap-1.5 rounded-2xl bg-krem-50 p-3 text-sm ring-1 ring-krem-200">
                      {MILESTONES.names.map((n, i) => (
                        <li key={n} className="flex justify-between">
                          <span className="text-stone-600">
                            {n} <span className="text-stone-400">· {MILESTONES.bps[i] / 100}%</span>
                          </span>
                          <span className="font-semibold">{formatUsdt((targetWei * BigInt(MILESTONES.bps[i])) / 10_000n)} USDT</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {phase !== "idle" && (
                    <Stepper
                      steps={[
                        { label: tr("Unggah foto", "Upload photo"), status: stepStatus(phase, "photo") },
                        { label: tr("Simpan detail", "Save details"), status: stepStatus(phase, "meta") },
                        { label: tr("Kirim", "Submit"), status: stepStatus(phase, "chain") },
                      ]}
                    />
                  )}
                  {formError && <Notice tone="error">{formError}</Notice>}
                  <Button type="submit" size="lg" variant="gold" loading={busy}>
                    {tr("Ajukan proyek tanam", "Propose crop project")}
                  </Button>
                  <TxStatus state={tx.state} successText={tr("Proyek dibuat. Membuka halamannya…", "Project created. Opening its page…")} />
                  <p className="text-xs leading-relaxed text-stone-500">{tr("Setelah diajukan, proyekmu direview admin dulu sebelum pendanaan dibuka.", "After you submit, the admin reviews your project before funding opens.")}</p>
                </div>
              </Card>
            </aside>
          </form>
        )}
      </PageBody>
    </>
  );
}
