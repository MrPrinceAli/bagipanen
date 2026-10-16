"use client";

import { tr } from "@/lib/i18n";
import { ArrowRight, ChevronDown, Cpu, HandCoins, ShieldAlert, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/scroll";
import { ButtonLink, IconBubble, PageBody, PageHero } from "@/components/ui";

type QA = { q: string; a: ReactNode };
type Group = { icon: LucideIcon; title: string; items: QA[] };

const groups = (): Group[] => [
  {
    icon: HandCoins,
    title: tr("Untuk investor", "For investors"),
    items: [
      {
        q: tr("Bagaimana cara ikut mendanai?", "How do I fund a project?"),
        a: tr("Hubungkan MetaMask ke BSC Testnet, minta mUSDT demo lewat tombol di header, lalu pilih proyek berstatus Cari dana. Danai dalam dua langkah: Izinkan mUSDT, lalu Danai. Setiap 1 USDT jadi 1 token porsi (BPS) yang mencatat bagianmu. Langkah lengkapnya ada di halaman Coba demo.", "Connect MetaMask to BSC Testnet, get demo mUSDT with the button in the header, then pick a project with the Funding status. Fund it in two steps: Approve mUSDT, then Fund. Every 1 USDT becomes 1 share token (BPS) that records your portion. The full steps are on the Try the demo page."),
      },
      {
        q: tr("Berapa imbal hasilnya?", "What's the return?"),
        a: tr("Tergantung hasil panen yang benar-benar terjual. Angka “proyeksi imbal hasil” di kartu proyek dihitung dari perkiraan petani, bukan janji. Saat panen, modal investor kembali dulu, lalu keuntungannya dibagi: 40% untuk investor, 55% untuk petani, 5% untuk dana cadangan. Di contoh demo cabai, imbal hasil investor 26% dalam satu musim.", "It depends on what the harvest actually sells for. The “projected return” on a project card is based on the farmer's estimate, not a promise. At harvest, investor capital comes back first, then the profit is split: 40% to investors, 55% to the farmer, 5% to the reserve fund. In the chili demo, investors earned a 26% return in one season."),
      },
      {
        q: tr("Bagaimana kalau target dana tidak tercapai?", "What if the funding target isn't reached?"),
        a: tr("Setelah tenggat lewat, siapa pun bisa menutup pendanaan, lalu setiap investor menarik kembali 100% dananya lewat tombol Refund. Contohnya proyek kentang Dieng.", "After the deadline, anyone can close the funding, and every investor takes back 100% of their money with the Refund button. See the Dieng potato project for an example."),
      },
      {
        q: tr("Bagaimana kalau gagal panen?", "What if the crop fails?"),
        a: tr("Admin menandai gagal panen berdasarkan bukti, misalnya data cuaca. Sisa dana yang belum cair otomatis menjadi milik investor sesuai porsi, dan bisa ditambah kompensasi dari dana cadangan. Petani tidak berutang, tetapi kejadiannya tercatat di Rapor Petani. Contohnya proyek padi Demak.", "The admin marks a crop failure based on evidence, such as weather data. Unreleased funds automatically go to investors by share, topped up by compensation from the reserve fund. The farmer isn't left in debt, but the event is recorded on their report card. See the Demak rice project for an example."),
      },
      {
        q: tr("Bagaimana kalau hasil panen di bawah modal?", "What if the harvest earns less than the capital?"),
        a: tr("Seluruh hasil penjualan yang disetor menjadi milik investor sesuai porsi. Petani dan dana cadangan tidak mendapat bagian di musim itu.", "All deposited sales proceeds go to investors by share. The farmer and the reserve fund get nothing that season."),
      },
      {
        q: tr("Bagaimana kalau petani tidak menyetor hasil panen?", "What if the farmer doesn't deposit the harvest?"),
        a: tr("Tiga puluh hari setelah perkiraan panen, admin bisa menandai gagal bayar. Sisa dana di kontrak menjadi milik investor, dan petani otomatis diblokir dari mengajukan proyek baru. Catatannya permanen di Rapor Petani.", "Thirty days after the expected harvest, the admin can mark a default. Whatever is left in the contract goes to investors, and the farmer is automatically blocked from proposing new projects. It stays on their report card permanently."),
      },
    ],
  },
  {
    icon: Sprout,
    title: tr("Untuk petani & koperasi", "For farmers & cooperatives"),
    items: [
      {
        q: tr("Siapa yang bisa mengajukan proyek tanam?", "Who can propose a crop project?"),
        a: tr("Petani yang sudah didaftarkan oleh koperasinya. Pengajuan direview admin dulu sebelum pendanaan dibuka.", "Farmers registered by their cooperative. The admin reviews each proposal before funding opens."),
      },
      {
        q: tr("Kenapa petani dapat bagian terbesar?", "Why does the farmer get the biggest share?"),
        a: tr("Petani yang menanggung kerja sepanjang musim. Sistem ijon membuat petani menjual panen murah sebelum waktunya; BagiPanen membalik itu: petani mendapat 55% keuntungan, dan risiko gagal panen tidak berubah menjadi utang.", "The farmer does the work all season. The ijon system makes farmers sell their harvest cheaply before it's grown; BagiPanen flips that: the farmer gets 55% of the profit, and a crop failure doesn't turn into debt."),
      },
      {
        q: tr("Bagaimana petani menerima rupiah?", "How do farmers receive rupiah?"),
        a: tr("Di versi testnet ini dana berupa mUSDT (token demo). Untuk versi nyata, rencananya koperasi menukar stablecoin ke rupiah lewat exchange berizin lalu menyalurkannya ke petani, sehingga petani tidak perlu mengurus kripto sendiri.", "In this testnet version, the funds are mUSDT (a demo token). For the real version, the plan is for cooperatives to convert stablecoins to rupiah through a licensed exchange and pass them on to farmers, so farmers never have to handle crypto themselves."),
      },
      {
        q: tr("Apa peran koperasi?", "What does the cooperative do?"),
        a: tr("Koperasi mendaftarkan petani anggota, memeriksa lahan sebagai kunci kedua pencairan (setelah agen AI), membantu penjualan, dan menerbitkan nota panen. Koperasi juga menilai putusan agen AI di registri reputasi ERC-8004.", "The cooperative registers member farmers, checks the field as the second key for releasing funds (after the AI agent), helps sell the harvest, and issues the harvest receipt. It also rates the AI agent's verdicts in the ERC-8004 reputation registry."),
      },
    ],
  },
  {
    icon: Cpu,
    title: tr("Teknologi & keamanan", "Technology & security"),
    items: [
      {
        q: tr("Apa yang dikerjakan agen AI?", "What does the AI agent do?"),
        a: tr("Agen adalah program otomatis di cloud. Untuk setiap foto bukti, agen mengecek lokasi GPS dan tanggal foto, mendeteksi foto daur ulang, membaca cuaca 14 hari dari Open-Meteo, lalu meminta Gemini menilai jenis tanaman dan fasenya. Alasannya disimpan di IPFS, dan putusannya ditulis ke kontrak dengan wallet agen.", "The agent is an automated program in the cloud. For every proof photo, it checks the photo's GPS location and date, detects recycled photos, reads 14 days of weather from Open-Meteo, then asks Gemini to assess the crop type and growth stage. Its reasons are stored on IPFS, and the verdict is written to the contract with the agent's wallet."),
      },
      {
        q: tr("Apa hubungannya dengan ERC-8004?", "How does ERC-8004 fit in?"),
        a: tr("Agen terdaftar di Identity Registry ERC-8004 resmi sebagai agen #2544, dan kontrak hanya menerima putusan dari pemegang identitas itu. Selain itu, koperasi menilai setiap putusan agen di Reputation Registry ERC-8004 resmi, jadi rekam jejak agen bisa dibaca aplikasi lain.", "The agent is registered in the official ERC-8004 Identity Registry as agent #2544, and the contract only accepts verdicts from the holder of that identity. Cooperatives also rate every verdict in the official ERC-8004 Reputation Registry, so other apps can read the agent's track record."),
      },
      {
        q: tr("Bisakah admin atau tim BagiPanen mengambil dana?", "Can the admin or the BagiPanen team take the money?"),
        a: tr("Tidak. Kontrak tidak punya fungsi untuk menarik dana ke admin. Admin hanya bisa menyetujui proyek, memutus sengketa, menandai gagal panen atau gagal bayar, dan menyalurkan dana cadangan ke proyek resmi yang gagal. Semua tindakan itu tercatat publik.", "No. The contracts have no function to withdraw funds to the admin. The admin can only approve projects, resolve disputes, mark crop failures or defaults, and send reserve funds to official projects that failed. All of those actions are recorded publicly."),
      },
      {
        q: tr("Kenapa putusan agen kadang butuh beberapa menit?", "Why does the agent's verdict sometimes take a few minutes?"),
        a: tr("Agen dijalankan GitHub Actions setiap ±5 menit, dan jadwalnya kadang terlambat. Selama menunggu, status bukti tetap “Bukti masuk” dan koperasi boleh memutuskan lebih dulu.", "The agent runs on GitHub Actions about every 5 minutes, and the schedule is sometimes late. While it waits, the proof stays at “Proof submitted”, and the cooperative may decide first."),
      },
      {
        q: tr("Data disimpan di mana?", "Where is the data stored?"),
        a: tr("Dana, status proyek, putusan, dan Rapor Petani ada di smart contract BNB Chain. Foto, metadata proyek, dan alasan putusan ada di IPFS. Tidak ada database atau server yang bisa mengubah data diam-diam.", "Funds, project status, verdicts, and farmer report cards live in smart contracts on BNB Chain. Photos, project metadata, and verdict reasons live on IPFS. There's no database or server that can quietly change the data."),
      },
    ],
  },
  {
    icon: ShieldAlert,
    title: tr("Status & batasan", "Status & limitations"),
    items: [
      {
        q: tr("Apakah ini memakai uang sungguhan?", "Does this use real money?"),
        a: tr("Tidak. BagiPanen berjalan di BSC Testnet dengan token demo mUSDT yang bisa diminta gratis. Ini prototipe untuk Indonesia Web3 Hackathon 2026.", "No. BagiPanen runs on BSC Testnet with the mUSDT demo token, which you can get for free. It's a prototype for the Indonesia Web3 Hackathon 2026."),
      },
      {
        q: tr("Apakah BagiPanen sudah legal sebagai produk investasi?", "Is BagiPanen a licensed investment product?"),
        a: tr("Belum, karena masih prototipe di testnet. Untuk produksi, rencananya bermitra dengan penyelenggara urun dana berizin OJK atau masuk sandbox regulasi.", "Not yet, since it's still a testnet prototype. For production, the plan is to partner with an OJK-licensed crowdfunding platform or join a regulatory sandbox."),
      },
      {
        q: tr("Foto lahan di proyek contoh dari mana?", "Where do the field photos in the sample projects come from?"),
        a: tr("Dari Wikimedia Commons dengan lisensi bebas, bukan foto lapangan asli, dan tidak punya data GPS. Agen mencatatnya sebagai “EXIF tidak ada” tanpa menolak. Nama petani dan koperasi di proyek contoh fiktif.", "From Wikimedia Commons under free licenses. They aren't real field photos and have no GPS data. The agent notes “no EXIF” without rejecting them. The farmer and cooperative names in the sample projects are fictional."),
      },
    ],
  },
];

function Item({ q, a }: QA) {
  return (
    <details className="group border-t border-krem-200 py-4 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-hutan-950 [&::-webkit-details-marker]:hidden">
        <span className="text-pretty">{q}</span>
        <ChevronDown className="mt-0.5 size-5 shrink-0 text-hutan-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-2 max-w-3xl leading-relaxed text-pretty text-stone-600">{a}</div>
    </details>
  );
}

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow={tr("Tanya jawab", "FAQ")}
        title={tr("Hal-hal yang sering ditanyakan", "Frequently asked questions")}
        description={tr("Cara kerja, risiko, dan batasan BagiPanen, dijelaskan apa adanya.", "How BagiPanen works, its risks, and its limits, explained plainly.")}
        actions={
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/coba" variant="gold">
              {tr("Coba demo", "Try the demo")} <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/transparansi" variant="light">
              {tr("Lihat transparansi dana", "See fund transparency")}
            </ButtonLink>
          </div>
        }
      />
      <PageBody>
        {groups().map((g, i) => (
          <Reveal key={g.title} delay={i === 0 ? 0 : 60}>
            <section className="rounded-3xl border border-krem-200 bg-white p-5 shadow-soft sm:p-7">
              <div className="mb-2 flex items-center gap-3">
                <IconBubble icon={g.icon} />
                <h2 className="font-display text-2xl font-semibold text-hutan-950">{g.title}</h2>
              </div>
              {g.items.map((it) => (
                <Item key={it.q} {...it} />
              ))}
            </section>
          </Reveal>
        ))}
      </PageBody>
    </>
  );
}
