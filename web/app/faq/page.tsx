"use client";

import { ArrowRight, ChevronDown, Cpu, HandCoins, ShieldAlert, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/scroll";
import { ButtonLink, IconBubble, PageBody, PageHero } from "@/components/ui";

type QA = { q: string; a: ReactNode };
type Group = { icon: LucideIcon; title: string; items: QA[] };

const GROUPS: Group[] = [
  {
    icon: HandCoins,
    title: "Untuk investor",
    items: [
      {
        q: "Bagaimana cara ikut mendanai?",
        a: "Hubungkan MetaMask ke BSC Testnet, minta mUSDT demo lewat tombol di header, lalu pilih proyek berstatus Cari dana. Danai dalam dua langkah: Izinkan mUSDT, lalu Danai. Setiap 1 USDT jadi 1 token porsi (BPS) yang mencatat bagianmu. Langkah lengkapnya ada di halaman Coba demo.",
      },
      {
        q: "Berapa imbal hasilnya?",
        a: "Tergantung hasil panen yang benar-benar terjual. Angka “proyeksi imbal hasil” di kartu proyek dihitung dari perkiraan petani, bukan janji. Saat panen, modal investor kembali dulu, lalu keuntungannya dibagi: 40% untuk investor, 55% untuk petani, 5% untuk dana cadangan. Di contoh demo cabai, imbal hasil investor 26% dalam satu musim.",
      },
      {
        q: "Bagaimana kalau target dana tidak tercapai?",
        a: "Setelah tenggat lewat, siapa pun bisa menutup pendanaan, lalu setiap investor menarik kembali 100% dananya lewat tombol Refund. Contohnya proyek kentang Dieng.",
      },
      {
        q: "Bagaimana kalau gagal panen?",
        a: "Admin menandai gagal panen berdasarkan bukti, misalnya data cuaca. Sisa dana yang belum cair otomatis menjadi milik investor sesuai porsi, dan bisa ditambah kompensasi dari dana cadangan. Petani tidak berutang, tetapi kejadiannya tercatat di Rapor Petani. Contohnya proyek padi Demak.",
      },
      {
        q: "Bagaimana kalau hasil panen di bawah modal?",
        a: "Seluruh hasil penjualan yang disetor menjadi milik investor sesuai porsi. Petani dan dana cadangan tidak mendapat bagian di musim itu.",
      },
      {
        q: "Bagaimana kalau petani tidak menyetor hasil panen?",
        a: "Tiga puluh hari setelah perkiraan panen, admin bisa menandai gagal bayar. Sisa dana di kontrak menjadi milik investor, dan petani otomatis diblokir dari mengajukan proyek baru. Catatannya permanen di Rapor Petani.",
      },
    ],
  },
  {
    icon: Sprout,
    title: "Untuk petani & koperasi",
    items: [
      {
        q: "Siapa yang bisa mengajukan proyek tanam?",
        a: "Petani yang sudah didaftarkan oleh koperasinya. Pengajuan direview admin dulu sebelum pendanaan dibuka.",
      },
      {
        q: "Kenapa petani dapat bagian terbesar?",
        a: "Petani yang menanggung kerja sepanjang musim. Sistem ijon membuat petani menjual panen murah sebelum waktunya; BagiPanen membalik itu: petani mendapat 55% keuntungan, dan risiko gagal panen tidak berubah menjadi utang.",
      },
      {
        q: "Bagaimana petani menerima rupiah?",
        a: "Di versi testnet ini dana berupa mUSDT (token demo). Untuk versi nyata, rencananya koperasi menukar stablecoin ke rupiah lewat exchange berizin lalu menyalurkannya ke petani, sehingga petani tidak perlu mengurus kripto sendiri.",
      },
      {
        q: "Apa peran koperasi?",
        a: "Koperasi mendaftarkan petani anggota, memeriksa lahan sebagai kunci kedua pencairan (setelah agen AI), membantu penjualan, dan menerbitkan nota panen. Koperasi juga menilai putusan agen AI di registri reputasi ERC-8004.",
      },
    ],
  },
  {
    icon: Cpu,
    title: "Teknologi & keamanan",
    items: [
      {
        q: "Apa yang dikerjakan agen AI?",
        a: "Agen adalah program otomatis di cloud. Untuk setiap foto bukti, agen mengecek lokasi GPS dan tanggal foto, mendeteksi foto daur ulang, membaca cuaca 14 hari dari Open-Meteo, lalu meminta Gemini menilai jenis tanaman dan fasenya. Alasannya disimpan di IPFS, dan putusannya ditulis ke kontrak dengan wallet agen.",
      },
      {
        q: "Apa hubungannya dengan ERC-8004?",
        a: "Agen terdaftar di Identity Registry ERC-8004 resmi sebagai agen #2544, dan kontrak hanya menerima putusan dari pemegang identitas itu. Selain itu, koperasi menilai setiap putusan agen di Reputation Registry ERC-8004 resmi, jadi rekam jejak agen bisa dibaca aplikasi lain.",
      },
      {
        q: "Bisakah admin atau tim BagiPanen mengambil dana?",
        a: "Tidak. Kontrak tidak punya fungsi untuk menarik dana ke admin. Admin hanya bisa menyetujui proyek, memutus sengketa, menandai gagal panen atau gagal bayar, dan menyalurkan dana cadangan ke proyek resmi yang gagal. Semua tindakan itu tercatat publik.",
      },
      {
        q: "Kenapa putusan agen kadang butuh beberapa menit?",
        a: "Agen dijalankan GitHub Actions setiap ±5 menit, dan jadwalnya kadang terlambat. Selama menunggu, status bukti tetap “Bukti masuk” dan koperasi boleh memutuskan lebih dulu.",
      },
      {
        q: "Data disimpan di mana?",
        a: "Dana, status proyek, putusan, dan Rapor Petani ada di smart contract BNB Chain. Foto, metadata proyek, dan alasan putusan ada di IPFS. Tidak ada database atau server yang bisa mengubah data diam-diam.",
      },
    ],
  },
  {
    icon: ShieldAlert,
    title: "Status & batasan",
    items: [
      {
        q: "Apakah ini memakai uang sungguhan?",
        a: "Tidak. BagiPanen berjalan di BSC Testnet dengan token demo mUSDT yang bisa diminta gratis. Ini prototipe untuk Indonesia Web3 Hackathon 2026.",
      },
      {
        q: "Apakah BagiPanen sudah legal sebagai produk investasi?",
        a: "Belum, karena masih prototipe di testnet. Untuk produksi, rencananya bermitra dengan penyelenggara urun dana berizin OJK atau masuk sandbox regulasi.",
      },
      {
        q: "Foto lahan di proyek contoh dari mana?",
        a: "Dari Wikimedia Commons dengan lisensi bebas, bukan foto lapangan asli, dan tidak punya data GPS. Agen mencatatnya sebagai “EXIF tidak ada” tanpa menolak. Nama petani dan koperasi di proyek contoh fiktif.",
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
        eyebrow="Tanya jawab"
        title="Hal-hal yang sering ditanyakan"
        description="Cara kerja, risiko, dan batasan BagiPanen, dijelaskan apa adanya."
        actions={
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/coba" variant="gold">
              Coba demo <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/transparansi" variant="light">
              Lihat transparansi dana
            </ButtonLink>
          </div>
        }
      />
      <PageBody>
        {GROUPS.map((g, i) => (
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
