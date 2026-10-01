"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { type Address, parseEventLogs } from "viem";
import { usePublicClient } from "wagmi";
import { Stepper, type StepStatus, TxStatus } from "@/components/common";
import { Button, Card, Field, Input, Notice, SectionTitle, Select, Spinner, Textarea } from "@/components/ui";
import { IS_LOCAL } from "@/lib/config";
import { campaignFactoryAbi } from "@/lib/abi/CampaignFactory";
import { reputationBookAbi } from "@/lib/abi/ReputationBook";
import { addresses, CONTRACTS_READY, requireAddresses } from "@/lib/addresses";
import { formatRupiah, formatUsdt, parseUsdtInput } from "@/lib/format";
import { uploadFile, uploadJson } from "@/lib/ipfs";
import { useRole } from "@/lib/role";
import { nowSeconds } from "@/lib/time";
import { useTx } from "@/lib/tx";
import type { CampaignMetadata } from "@/lib/types";

const MILESTONES = { names: ["Tanam", "Tumbuh", "Pra-panen"], bps: [4000, 3500, 2500] };
const DURATIONS = [
  { value: 600, label: "10 menit (demo)" },
  { value: 3600, label: "1 jam" },
  { value: 86_400, label: "1 hari" },
  { value: 7 * 86_400, label: "7 hari" },
  { value: 30 * 86_400, label: "30 hari" },
];

type CostRow = { item: string; usdt: string };

function isoDatePlusDays(days: number) {
  const d = new Date((nowSeconds() + days * 86_400) * 1000);
  return d.toISOString().slice(0, 10);
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
        if (overwrite || (!lat && !lon)) {
          setLat(gps.latitude.toFixed(6));
          setLon(gps.longitude.toFixed(6));
          setCoordNote("Koordinat diisi dari GPS foto lahan.");
        }
        return;
      }
      if (overwrite) setCoordNote("Foto ini tidak punya data GPS. Isi manual atau pakai lokasi perangkat.");
    } catch {
      if (overwrite) setCoordNote("Tidak bisa membaca data GPS dari foto ini.");
    }
  }

  function coordsFromDevice() {
    if (!navigator.geolocation) return setCoordNote("Perangkat tidak mendukung lokasi.");
    setCoordNote("Mengambil lokasi perangkat…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
        setCoordNote("Koordinat diisi dari lokasi perangkat.");
      },
      () => setCoordNote("Izin lokasi ditolak atau lokasi tidak tersedia."),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function fillDemo() {
    setCommodity("Cabai merah");
    setTitle("Modal tanam cabai merah musim hujan 2026");
    setStory(
      "Pak Darto menanam cabai merah di lahan 0,5 ha di Cikajang, Garut, didampingi Koperasi Tani Makmur. Modal dipakai untuk bibit, pupuk, pestisida, dan tenaga kerja satu musim tanam.",
    );
    setLocationName("Cikajang, Garut");
    // Koordinat contoh Cikajang (id.wikipedia.org/wiki/Cikajang,_Garut). Tidak menimpa koordinat dari GPS foto.
    if (!lat && !lon) {
      setLat("-7.356436");
      setLon("107.806990");
      setCoordNote("Koordinat contoh: Cikajang, Garut. Ganti sesuai lokasi lahan jika memakai foto asli ber-GPS.");
    }
    setLandArea("5000");
    setTarget("1.000");
    setEstimate("1.650");
    setHarvestDate(isoDatePlusDays(120));
    setDuration(600);
    setCostPlan([
      { item: "Bibit", usdt: "250" },
      { item: "Pupuk & pestisida", usdt: "400" },
      { item: "Tenaga kerja", usdt: "350" },
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
    if (!locationName.trim()) problems.push("nama lokasi");
    if (!Number.isFinite(latN) || Math.abs(latN) > 90 || !lat) problems.push("lintang");
    if (!Number.isFinite(lonN) || Math.abs(lonN) > 180 || !lon) problems.push("bujur");
    if (!Number.isInteger(area) || area <= 0) problems.push("luas lahan (m², bilangan bulat)");
    if (!targetWei || targetWei <= 0n) problems.push("target modal");
    if (!estimateWei || estimateWei <= 0n) problems.push("estimasi hasil penjualan");
    if (!harvestUnix || harvestUnix <= nowSeconds()) problems.push("perkiraan tanggal panen (harus di masa depan)");
    if (!photo) problems.push("foto lahan awal");
    if (rows.some((r) => parseUsdtInput(r.usdt) === null)) problems.push("jumlah di rencana biaya");
    if (problems.length) return setFormError(`Periksa isian: ${problems.join(", ")}.`);

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
      setFormError(err instanceof Error ? err.message : "Gagal mengunggah file.");
    }
  }

  if (!CONTRACTS_READY) return <Notice tone="warn">Alamat kontrak belum diatur.</Notice>;
  if (role === undefined) return <Spinner />;
  if (role !== "petani")
    return (
      <Notice tone="info">
        Halaman ini untuk petani yang sudah didaftarkan koperasi.{" "}
        {role === "tamu" ? `${IS_LOCAL ? "Pilih akun" : "Hubungkan dompet"} Petani di header.` : "Wallet Anda saat ini bukan petani."}
      </Notice>
    );
  if (names.data?.blocked)
    return <Notice tone="error">Wallet ini diblokir membuat kampanye baru karena pernah gagal bayar (tercatat di Rapor Petani).</Notice>;

  const stepStatus = (p: typeof phase, mine: "photo" | "meta" | "chain"): StepStatus => {
    const order = ["photo", "meta", "chain", "done"];
    const cur = order.indexOf(p);
    const idx = order.indexOf(mine);
    if (cur === -1) return "todo";
    return cur > idx ? "done" : cur === idx ? "active" : "todo";
  };
  const busy = phase !== "idle" && phase !== "done";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-daun-900">Ajukan kampanye</h1>
          <p className="text-sm text-stone-600">
            {names.data ? `${names.data.farmerName} · didampingi ${names.data.cooperativeName}` : "Memuat data petani…"}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={fillDemo}>
          Isi contoh data demo
        </Button>
      </div>

      <Card>
        <SectionTitle>Tanaman & cerita</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Komoditas" htmlFor="commodity">
            <Input id="commodity" list="commodities" value={commodity} onChange={(e) => setCommodity(e.target.value)} placeholder="Cabai merah" />
            <datalist id="commodities">
              <option value="Cabai merah" />
              <option value="Padi" />
              <option value="Bawang merah" />
              <option value="Tomat" />
              <option value="Jagung" />
            </datalist>
          </Field>
          <Field label="Judul kampanye" htmlFor="title">
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Modal tanam cabai merah musim hujan" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Cerita singkat" htmlFor="story" hint="Siapa Anda, lahan seperti apa, dan untuk apa modalnya.">
              <Textarea id="story" value={story} onChange={(e) => setStory(e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Lahan</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Foto lahan awal" htmlFor="photo" hint="JPEG/PNG/WebP, maks 5 MB. Unggah langsung dari galeri kamera agar data GPS & tanggal (EXIF) tidak hilang.">
              <Input
                id="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => selectPhoto(e.target.files?.[0] ?? null)}
              />
            </Field>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- pratinjau file lokal (blob URL)
              <img src={preview} alt="Pratinjau foto lahan" className="mt-2 h-48 w-full rounded-xl object-cover" />
            )}
          </div>
          <Field label="Nama lokasi" htmlFor="loc">
            <Input id="loc" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Cikajang, Garut" />
          </Field>
          <Field label="Luas lahan (m²)" htmlFor="area" hint="0,5 ha = 5000 m²">
            <Input id="area" inputMode="numeric" value={landArea} onChange={(e) => setLandArea(e.target.value)} placeholder="5000" />
          </Field>
          <Field label="Lintang (latitude)" htmlFor="lat">
            <Input id="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-7.2" />
          </Field>
          <Field label="Bujur (longitude)" htmlFor="lon">
            <Input id="lon" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="107.8" />
          </Field>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="button" size="sm" variant="secondary" disabled={!photo} onClick={() => photo && coordsFromPhoto(photo, true)}>
              Ambil dari GPS foto
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={coordsFromDevice}>
              Pakai lokasi perangkat
            </Button>
            {coordNote && <span className="text-xs text-stone-600">{coordNote}</span>}
          </div>
          <p className="text-xs text-stone-500 sm:col-span-2">
            Agen AI memeriksa jarak GPS foto bukti ke koordinat ini (maksimal 2 km), jadi isi sesuai lokasi lahan sebenarnya.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>Pendanaan</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kebutuhan modal (USDT)" htmlFor="target" hint={targetWei ? `≈ ${formatRupiah(targetWei)} (perkiraan)` : "Gunakan koma untuk desimal"}>
            <Input id="target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="1.000" />
          </Field>
          <Field
            label="Estimasi hasil penjualan (USDT)"
            htmlFor="estimate"
            hint={estimateWei ? `≈ ${formatRupiah(estimateWei)} (perkiraan)` : undefined}
          >
            <Input id="estimate" inputMode="decimal" value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="1.650" />
          </Field>
          <Field label="Perkiraan tanggal panen" htmlFor="harvest">
            <Input id="harvest" type="date" min={isoDatePlusDays(1)} value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
          </Field>
          <Field label="Durasi pendanaan" htmlFor="duration">
            <Select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mt-4 text-sm text-stone-600">
          Pencairan bertahap: <strong>Tanam 40%</strong> · <strong>Tumbuh 35%</strong> · <strong>Pra-panen 25%</strong>, masing-masing
          setelah bukti foto disetujui agen AI dan koperasi.
        </p>
      </Card>

      <Card>
        <SectionTitle
          action={
            <Button type="button" size="sm" variant="ghost" onClick={() => setCostPlan([...costPlan, { item: "", usdt: "" }])}>
              + Tambah baris
            </Button>
          }
        >
          Rencana biaya
        </SectionTitle>
        <div className="flex flex-col gap-2">
          {costPlan.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input
                aria-label={`Pos biaya ${i + 1}`}
                value={row.item}
                onChange={(e) => setCostPlan(costPlan.map((r, j) => (j === i ? { ...r, item: e.target.value } : r)))}
                placeholder="Bibit"
              />
              <Input
                aria-label={`Jumlah USDT ${i + 1}`}
                className="w-32"
                inputMode="decimal"
                value={row.usdt}
                onChange={(e) => setCostPlan(costPlan.map((r, j) => (j === i ? { ...r, usdt: e.target.value } : r)))}
                placeholder="USDT"
              />
              <Button type="button" variant="ghost" size="sm" aria-label="Hapus baris" onClick={() => setCostPlan(costPlan.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
          ))}
          {targetWei && (
            <p className="text-xs text-stone-500">
              Total rencana:{" "}
              {formatUsdt(costPlan.reduce((s, r) => s + (parseUsdtInput(r.usdt) ?? 0n), 0n))} dari {formatUsdt(targetWei)} USDT
            </p>
          )}
        </div>
      </Card>

      <Card>
        {phase !== "idle" && (
          <div className="mb-4">
            <Stepper
              steps={[
                { label: "Unggah foto lahan", status: stepStatus(phase, "photo") },
                { label: "Unggah metadata", status: stepStatus(phase, "meta") },
                { label: "Kirim ke blockchain", status: stepStatus(phase, "chain") },
              ]}
            />
          </div>
        )}
        {formError && (
          <div className="mb-3">
            <Notice tone="error">{formError}</Notice>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button type="submit" loading={busy}>
            Ajukan kampanye
          </Button>
          <TxStatus state={tx.state} successText="Kampanye dibuat. Membuka halaman kampanye…" />
          <p className="text-xs text-stone-500">Status awal kampanye adalah Draf sampai disetujui admin.</p>
        </div>
      </Card>
    </form>
  );
}
