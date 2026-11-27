'use client'

import React from 'react'
import ReportPrintableView from '@/components/finance/report-printable-view'
import { formatFinanceDate } from '@/lib/finance/date-format'
import type {
  ArrearItemRow,
  ArrearsReportResponse,
  CashSessionItemRow,
  CashSessionsReportResponse,
  DistributionItemRow,
  DistributionsReportResponse,
  ExemptionItemRow,
  ExemptionsReportResponse,
  ReceiptItemRow,
  ReceiptsReportResponse,
  ReconciliationReportRow,
  ReconciliationsReportResponse,
  ReportType,
  SettlementItemRow,
  SettlementsReportResponse,
  StudentDetailObligationRow,
  StudentDetailReportResponse,
  WalletMutationRow,
  WalletReportResponse,
  WalletSummaryRow,
} from '@/lib/finance/reports'
import {
  formatAllocationsSummary,
  formatCashSessionStatus,
  formatDistributionMethod,
  formatDistributionStatus,
  formatExemptionStatus,
  formatItemsCsv,
  formatMatchStatus,
  formatObligationStatus,
  formatPaymentChannel,
  formatPaymentStatus,
  formatPeriodLabel,
  formatRecipientType,
  formatResolutionAction,
  formatRupiah,
  formatSettlementStatus,
  formatWalletMovement,
} from './report-formatters'

interface ReportPrintModalsProps {
  activeTab: ReportType
  isOpen: boolean
  onClose: () => void
  asrama: string
  kelas: string
  period: string
  startDate: string
  endDate: string
  itemType: string
  exemptionStatus: string
  receiptsData: ReceiptsReportResponse
  distributionsData: DistributionsReportResponse | null
  arrearsData: ArrearsReportResponse | null
  exemptionsData: ExemptionsReportResponse | null
  studentDetailData: StudentDetailReportResponse | null
  walletData: WalletReportResponse | null
  cashSessionsData: CashSessionsReportResponse | null
  settlementsData: SettlementsReportResponse | null
  reconciliationsData: ReconciliationsReportResponse | null
}

export function ReportPrintModals({
  activeTab,
  isOpen,
  onClose,
  asrama,
  kelas,
  period,
  startDate,
  endDate,
  itemType,
  exemptionStatus,
  receiptsData,
  distributionsData,
  arrearsData,
  exemptionsData,
  studentDetailData,
  walletData,
  cashSessionsData,
  settlementsData,
  reconciliationsData,
}: ReportPrintModalsProps) {
  const isPrintViewAvailable =
    activeTab === 'PENERIMAAN' ||
    (activeTab === 'PENUNGGAK' && Boolean(arrearsData)) ||
    (activeTab === 'PENYALURAN' && Boolean(distributionsData)) ||
    (activeTab === 'UANG_JAJAN' && Boolean(walletData)) ||
    (activeTab === 'PEMBEBASAN' && Boolean(exemptionsData)) ||
    (activeTab === 'DETAIL_SANTRI' && Boolean(studentDetailData)) ||
    (activeTab === 'TRANSAKSI_LOKET' && Boolean(cashSessionsData)) ||
    (activeTab === 'SETTLEMENT' && Boolean(settlementsData)) ||
    (activeTab === 'REKONSILIASI' && Boolean(reconciliationsData))

  const asramaLabel = asrama === 'ALL' ? 'Semua' : asrama
  const kelasLabel = kelas === 'ALL' ? 'Semua' : kelas
  const periodLabel = period ? formatPeriodLabel(period) : 'Semua'
  const dateRangeLabel = `${startDate || 'Awal'} s.d. ${endDate || 'Akhir'}`

  return (
    <>
      {activeTab === 'PENERIMAAN' && (
        <ReportPrintableView<ReceiptItemRow>
          isOpen={isOpen}
          onClose={onClose}
          title="LAPORAN PENERIMAAN KAS & PEMBAYARAN"
          subtitle="Pondok Pesantren Eskahade — Rekap Penerimaan BRIVA, Transfer Manual & Tunai"
          filterSummary={`Asrama: ${asramaLabel} | Kelas: ${kelasLabel} | Periode: ${periodLabel}`}
          kpis={[
            { label: 'Total Bruto', value: formatRupiah(receiptsData.kpi.totalGross) },
            { label: 'Admin Koperasi', value: formatRupiah(receiptsData.kpi.totalFee) },
            { label: 'Kode Unik Transfer', value: formatRupiah(receiptsData.kpi.totalUniqueCode) },
            { label: 'Penerimaan Bersih', value: formatRupiah(receiptsData.kpi.totalNet) },
          ]}
          columns={[
            { header: 'No. Bayar', accessor: (r) => r.paymentNumber, align: 'center' },
            { header: 'Waktu (WIB)', accessor: (r) => formatFinanceDate(r.paidAt, true), align: 'center' },
            { header: 'Nama Santri', accessor: (r) => `${r.santriName} (${r.santriNis})` },
            { header: 'Saluran', accessor: (r) => formatPaymentChannel(r.channel).label, align: 'center' },
            { header: 'Alokasi Pos', accessor: (r) => formatAllocationsSummary(r.allocationsSummary).display },
            { header: 'Nominal', accessor: (r) => formatRupiah(r.grossAmount), align: 'right' },
            { header: 'Admin Kop.', accessor: (r) => formatRupiah(r.gatewayFee), align: 'right' },
            { header: 'Status', accessor: (r) => formatPaymentStatus(r.status).label, align: 'center' },
          ]}
          data={receiptsData.items}
          footerTotals={[
            { label: 'Total Bruto', value: formatRupiah(receiptsData.kpi.totalGross), colSpan: 7 },
            { label: 'Admin Koperasi', value: formatRupiah(receiptsData.kpi.totalFee), colSpan: 2 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'PENUNGGAK' && arrearsData && (
        <ReportPrintableView<ArrearItemRow>
          isOpen={isOpen}
          onClose={onClose}
          title="LAPORAN SANTRI MENUNGGAK & PIUTANG BIAYA"
          subtitle="Pondok Pesantren Eskahade — Monitoring Kewajiban Santri"
          filterSummary={`Asrama: ${asramaLabel} | Kelas: ${kelasLabel} | Periode: ${periodLabel}`}
          kpis={[
            { label: 'Total Piutang', value: formatRupiah(arrearsData.kpi.totalArrears) },
            { label: 'Santri Menunggak', value: `${arrearsData.kpi.uniqueStudentsCount} santri` },
            { label: 'Total Tagihan', value: `${arrearsData.kpi.totalObligations} item` },
            { label: 'Rata-rata / Santri', value: formatRupiah(arrearsData.kpi.averageArrearsPerStudent) },
          ]}
          columns={[
            { header: 'NIS', accessor: (r) => r.santriNis, align: 'center' },
            { header: 'Nama Santri', accessor: (r) => r.santriName },
            { header: 'Asrama / Kelas', accessor: (r) => `${r.santriAsrama || '-'} / ${r.santriKelas || '-'}` },
            { header: 'Periode', accessor: (r) => formatPeriodLabel(r.period), align: 'center' },
            { header: 'Pos Biaya', accessor: (r) => r.itemLabel },
            { header: 'Kewajiban', accessor: (r) => formatRupiah(r.amountExpected), align: 'right' },
            { header: 'Terbayar', accessor: (r) => formatRupiah(r.amountPaid), align: 'right' },
            { header: 'Sisa Tunggakan', accessor: (r) => formatRupiah(r.remaining), align: 'right' },
          ]}
          data={arrearsData.items}
          footerTotals={[
            { label: 'Total Tunggakan', value: formatRupiah(arrearsData.kpi.totalArrears), colSpan: 9 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'PENYALURAN' && distributionsData && (
        <ReportPrintableView<DistributionItemRow>
          isOpen={isOpen}
          onClose={onClose}
          title="LAPORAN PENYALURAN DANA KE REKANAN & BENDAHARA"
          subtitle="Pondok Pesantren Eskahade — Penyaluran Dana Pesantren, Katering & Laundry"
          filterSummary={`Rentang Tanggal: ${dateRangeLabel}`}
          kpis={[
            { label: 'Total Disalurkan', value: formatRupiah(distributionsData.kpi.totalDisbursed) },
            { label: 'Bendahara Pesantren', value: formatRupiah(distributionsData.kpi.totalBendahara) },
            { label: 'Katering', value: formatRupiah(distributionsData.kpi.totalKatering) },
            { label: 'Laundry', value: formatRupiah(distributionsData.kpi.totalLaundry) },
          ]}
          columns={[
            { header: 'No. Penyaluran', accessor: (r) => r.distributionNumber, align: 'center' },
            { header: 'Waktu (WIB)', accessor: (r) => formatFinanceDate(r.reportDate, true), align: 'center' },
            { header: 'Penerima', accessor: (r) => `${r.recipientName} (${formatRecipientType(r.recipientType)})` },
            {
              header: 'Metode / Rekening',
              accessor: (r) =>
                `${formatDistributionMethod(r.method)}${
                  r.method !== 'CASH' && (r.destinationBank || r.destinationAccount)
                    ? ` — ${[r.destinationBank, r.destinationAccount].filter(Boolean).join(': ')}`
                    : ''
                }`,
            },
            { header: 'Rincian Pos', accessor: (r) => formatItemsCsv(r.itemsSummary) },
            { header: 'Nominal Salur', accessor: (r) => formatRupiah(r.amount), align: 'right' },
            { header: 'Petugas', accessor: (r) => r.operatorName || '-' },
            { header: 'Status', accessor: (r) => formatDistributionStatus(r.status).label, align: 'center' },
          ]}
          data={distributionsData.items}
          footerTotals={[
            { label: 'Total Disalurkan', value: formatRupiah(distributionsData.kpi.totalDisbursed), colSpan: 9 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'UANG_JAJAN' && walletData && walletData.mode === 'SUMMARY' && (
        <ReportPrintableView<WalletSummaryRow>
          isOpen={isOpen}
          onClose={onClose}
          title="LAPORAN SALDO TITIPAN UANG JAJAN SANTRI"
          subtitle="Pondok Pesantren Eskahade — Rekapitulasi Dana Titipan Uang Jajan (Bukan Pendapatan Pondok)"
          filterSummary={`Mode: Rekap Saldo | Asrama: ${asramaLabel} | Kelas: ${kelasLabel}`}
          kpis={[
            { label: 'Total Saldo Titipan', value: formatRupiah(walletData.kpi.totalCurrentBalance) },
            { label: 'Total Setoran Masuk', value: formatRupiah(walletData.kpi.totalDepositIn) },
            { label: 'Total Pencairan Bersih', value: formatRupiah(walletData.kpi.totalWithdrawalOut) },
            { label: 'Total Mutasi', value: `${walletData.kpi.totalMutationsCount} baris` },
          ]}
          columns={[
            { header: 'NIS', accessor: (r) => r.santriNis, align: 'center' },
            { header: 'Nama Santri', accessor: (r) => r.santriName },
            { header: 'Asrama / Kelas', accessor: (r) => `${r.santriAsrama || '-'} / ${r.santriKelas || '-'}` },
            { header: 'Total Setor', accessor: (r) => formatRupiah(r.totalIn), align: 'right' },
            { header: 'Total Tarik', accessor: (r) => formatRupiah(r.totalOut), align: 'right' },
            { header: 'Saldo Saat Ini', accessor: (r) => formatRupiah(r.currentBalance), align: 'right' },
            { header: 'Limit Harian', accessor: (r) => formatRupiah(r.effectiveDailyLimit), align: 'right' },
          ]}
          data={walletData.summaryItems || []}
          orientation="landscape"
        />
      )}

      {activeTab === 'UANG_JAJAN' && walletData && walletData.mode === 'MUTATION' && (
        <ReportPrintableView<WalletMutationRow>
          isOpen={isOpen}
          onClose={onClose}
          title="BUKU BESAR MUTASI UANG JAJAN SANTRI"
          subtitle="Pondok Pesantren Eskahade — Jurnal Mutasi Dana Titipan"
          filterSummary={`Mode: Mutasi | Asrama: ${asramaLabel} | Rentang: ${dateRangeLabel}`}
          kpis={[
            { label: 'Total Saldo Titipan', value: formatRupiah(walletData.kpi.totalCurrentBalance) },
            { label: 'Total Setoran Masuk', value: formatRupiah(walletData.kpi.totalDepositIn) },
            { label: 'Total Pencairan Bersih', value: formatRupiah(walletData.kpi.totalWithdrawalOut) },
            { label: 'Total Mutasi', value: `${walletData.kpi.totalMutationsCount} baris` },
          ]}
          columns={[
            { header: 'Waktu (WIB)', accessor: (r) => formatFinanceDate(r.createdAt, true), align: 'center' },
            { header: 'Nama Santri', accessor: (r) => `${r.santriName} (${r.santriNis})` },
            { header: 'Jenis Mutasi', accessor: (r) => formatWalletMovement(r.movementType) },
            { header: 'Arah', accessor: (r) => (r.direction === 'IN' ? 'Masuk' : 'Keluar'), align: 'center' },
            { header: 'Nominal', accessor: (r) => formatRupiah(r.amount), align: 'right' },
            { header: 'Saldo Akhir', accessor: (r) => formatRupiah(r.balanceAfter), align: 'right' },
            { header: 'Petugas', accessor: (r) => r.operatorName || '-' },
          ]}
          data={walletData.mutationItems || []}
          orientation="landscape"
        />
      )}

      {activeTab === 'PEMBEBASAN' && exemptionsData && (
        <ReportPrintableView<ExemptionItemRow>
          isOpen={isOpen}
          onClose={onClose}
          title="LAPORAN SANTRI DIBEBASKAN DARI BIAYA"
          subtitle="Pondok Pesantren Eskahade — Rekapitulasi Keringanan & Pembebasan Biaya"
          filterSummary={`Asrama: ${asramaLabel} | Kelas: ${kelasLabel} | Pos: ${itemType === 'ALL' ? 'Semua' : itemType} | Status: ${exemptionStatus === 'ALL' ? 'Semua' : formatExemptionStatus(exemptionStatus).label}`}
          kpis={[
            { label: 'Total Nominal Bebas', value: formatRupiah(exemptionsData.kpi.totalNominalExempted) },
            { label: 'Pembebasan Aktif', value: `${exemptionsData.kpi.activeExemptionsCount} data` },
            { label: 'Dicabut', value: `${exemptionsData.kpi.revokedExemptionsCount} data` },
            { label: 'Santri Terdampak', value: `${exemptionsData.kpi.uniqueStudentsCount} santri` },
          ]}
          columns={[
            { header: 'NIS', accessor: (r) => r.santriNis, align: 'center' },
            { header: 'Nama Santri', accessor: (r) => r.santriName },
            { header: 'Asrama / Kelas', accessor: (r) => `${r.santriAsrama || '-'} / ${r.santriKelas || '-'}` },
            { header: 'Pos Biaya', accessor: (r) => r.itemLabel },
            {
              header: 'Periode Berlaku',
              accessor: (r) =>
                `${r.periodStart ? formatPeriodLabel(r.periodStart) : 'Awal'} s.d. ${
                  r.periodEnd ? formatPeriodLabel(r.periodEnd) : 'Seterusnya'
                }`,
              align: 'center',
            },
            { header: 'Alasan', accessor: (r) => r.reason },
            { header: 'Nominal Terbebas', accessor: (r) => formatRupiah(r.totalExemptedAmount), align: 'right' },
            { header: 'Status', accessor: (r) => formatExemptionStatus(r.status).label, align: 'center' },
            { header: 'Diberikan Oleh', accessor: (r) => r.createdByName || '-' },
          ]}
          data={exemptionsData.items}
          footerTotals={[
            { label: 'Total Nominal Terbebas', value: formatRupiah(exemptionsData.kpi.totalNominalExempted), colSpan: 10 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'DETAIL_SANTRI' && studentDetailData && (
        <ReportPrintableView<StudentDetailObligationRow>
          isOpen={isOpen}
          onClose={onClose}
          title="LEMBAR KEUANGAN SANTRI"
          subtitle={
            studentDetailData.student
              ? `${studentDetailData.student.nama} — NIS ${studentDetailData.student.nis}`
              : 'Data santri belum tersedia'
          }
          filterSummary={
            studentDetailData.student
              ? `Asrama: ${studentDetailData.student.asrama || '-'} (Kamar ${studentDetailData.student.kamar || '-'}) | Kelas: ${studentDetailData.student.kelas || '-'} | Saldo Uang Jajan: ${formatRupiah(studentDetailData.student.walletBalance)}`
              : 'Semua data'
          }
          kpis={[
            { label: 'Total Kewajiban', value: formatRupiah(studentDetailData.summary.totalExpected) },
            { label: 'Keringanan', value: formatRupiah(studentDetailData.summary.totalExempted) },
            { label: 'Sudah Terbayar', value: formatRupiah(studentDetailData.summary.totalPaid) },
            { label: 'Sisa Tanggungan', value: formatRupiah(studentDetailData.summary.totalRemaining) },
          ]}
          columns={[
            { header: 'Periode', accessor: (r) => formatPeriodLabel(r.period), align: 'center' },
            { header: 'Pos Tagihan', accessor: (r) => r.itemLabel },
            { header: 'Tagihan', accessor: (r) => formatRupiah(r.amountExpected), align: 'right' },
            { header: 'Keringanan', accessor: (r) => formatRupiah(r.amountExempted), align: 'right' },
            { header: 'Terbayar', accessor: (r) => formatRupiah(r.amountPaid), align: 'right' },
            { header: 'Sisa', accessor: (r) => formatRupiah(r.remaining), align: 'right' },
            { header: 'Status', accessor: (r) => formatObligationStatus(r.status).label, align: 'center' },
          ]}
          data={studentDetailData.obligations}
          footerTotals={[
            { label: 'Total Sisa Tanggungan', value: formatRupiah(studentDetailData.summary.totalRemaining), colSpan: 8 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'TRANSAKSI_LOKET' && cashSessionsData && (
        <ReportPrintableView<CashSessionItemRow>
          isOpen={isOpen}
          onClose={onClose}
          title="LAPORAN SESI KAS & TRANSAKSI LOKET"
          subtitle="Pondok Pesantren Eskahade — Rekonsiliasi Kas Fisik Loket Koperasi"
          filterSummary={`Rentang Tanggal: ${dateRangeLabel}`}
          kpis={[
            { label: 'Total Sesi', value: `${cashSessionsData.kpi.totalSessionsCount} sesi` },
            { label: 'Total Kas Masuk', value: formatRupiah(cashSessionsData.kpi.totalCashInAllSessions) },
            { label: 'Total Kas Keluar', value: formatRupiah(cashSessionsData.kpi.totalCashOutAllSessions) },
            {
              label: 'Sesi Berselisih',
              value: `${cashSessionsData.kpi.discrepancySessionsCount} sesi (${formatRupiah(cashSessionsData.kpi.totalDifference)})`,
            },
          ]}
          columns={[
            { header: 'Kode Sesi', accessor: (r) => r.sessionCode, align: 'center' },
            { header: 'Kasir', accessor: (r) => r.operatorName },
            { header: 'Buka (WIB)', accessor: (r) => formatFinanceDate(r.openedAt, true), align: 'center' },
            {
              header: 'Tutup (WIB)',
              accessor: (r) => (r.closedAt ? formatFinanceDate(r.closedAt, true) : 'Terbuka'),
              align: 'center',
            },
            { header: 'Saldo Awal', accessor: (r) => formatRupiah(r.openingBalance), align: 'right' },
            { header: 'Kas Masuk', accessor: (r) => formatRupiah(r.totalCashIn), align: 'right' },
            { header: 'Kas Keluar', accessor: (r) => formatRupiah(r.totalCashOut), align: 'right' },
            { header: 'Seharusnya', accessor: (r) => formatRupiah(r.expectedClosingBalance), align: 'right' },
            {
              header: 'Fisik',
              accessor: (r) => (r.actualClosingBalance !== null ? formatRupiah(r.actualClosingBalance) : '-'),
              align: 'right',
            },
            {
              header: 'Selisih',
              accessor: (r) => (r.difference !== null ? formatRupiah(r.difference) : '-'),
              align: 'right',
            },
            { header: 'Status', accessor: (r) => formatCashSessionStatus(r.status).label, align: 'center' },
          ]}
          data={cashSessionsData.items}
          orientation="landscape"
        />
      )}

      {activeTab === 'SETTLEMENT' && settlementsData && (
        <ReportPrintableView<SettlementItemRow>
          isOpen={isOpen}
          onClose={onClose}
          title="LAPORAN SETTLEMENT BANK (BRI)"
          subtitle="Rekonsiliasi penerimaan rekening Koperasi — hak penyaluran mengikuti alokasi, bukan total settlement"
          filterSummary={`Rentang Tanggal: ${dateRangeLabel}`}
          kpis={[
            { label: 'Total Bruto', value: formatRupiah(settlementsData.kpi.totalGrossSettled) },
            { label: 'Potongan Settlement', value: formatRupiah(settlementsData.kpi.totalFeeDeducted) },
            { label: 'Net Masuk Rekening', value: formatRupiah(settlementsData.kpi.totalNetReceived) },
            { label: 'Jumlah Batch', value: `${settlementsData.kpi.totalSettlementBatches} batch` },
          ]}
          columns={[
            { header: 'No. Settlement', accessor: (r) => r.settlementNumber, align: 'center' },
            { header: 'Tanggal', accessor: (r) => r.settlementDate, align: 'center' },
            { header: 'Bank Tujuan', accessor: (r) => r.destinationBank },
            { header: 'No. Rekening', accessor: (r) => r.destinationAccount, align: 'center' },
            { header: 'Atas Nama', accessor: (r) => r.accountHolderName },
            { header: 'Jml Trx', accessor: (r) => r.itemCount, align: 'center' },
            { header: 'Bruto', accessor: (r) => formatRupiah(r.grossAmount), align: 'right' },
            { header: 'Potongan', accessor: (r) => formatRupiah(r.totalFee), align: 'right' },
            { header: 'Net Masuk', accessor: (r) => formatRupiah(r.netAmount), align: 'right' },
            { header: 'Status', accessor: (r) => formatSettlementStatus(r.status).label, align: 'center' },
          ]}
          data={settlementsData.items}
          footerTotals={[
            { label: 'Total Net Masuk Rekening', value: formatRupiah(settlementsData.kpi.totalNetReceived), colSpan: 11 },
          ]}
          orientation="landscape"
        />
      )}

      {activeTab === 'REKONSILIASI' && reconciliationsData && (
        <ReportPrintableView<ReconciliationReportRow>
          isOpen={isOpen}
          onClose={onClose}
          title="LAPORAN AUDIT REKONSILIASI & RESOLUSI SELISIH"
          subtitle="Pondok Pesantren Eskahade — Pencocokan Pembayaran vs Rekening Bank"
          filterSummary={`Rentang Tanggal: ${dateRangeLabel}`}
          kpis={[
            { label: 'Cocok', value: `${reconciliationsData.kpi.totalMatchedItems} data` },
            { label: 'Selisih', value: `${reconciliationsData.kpi.totalDiscrepancyItems} data` },
            { label: 'Nilai Selisih', value: formatRupiah(reconciliationsData.kpi.totalDiscrepancyAmount) },
            { label: 'Diselesaikan', value: `${reconciliationsData.kpi.totalResolvedItems} data` },
          ]}
          columns={[
            { header: 'Waktu (WIB)', accessor: (r) => formatFinanceDate(r.createdAt, true), align: 'center' },
            { header: 'Status', accessor: (r) => formatMatchStatus(r.matchStatus).label, align: 'center' },
            { header: 'Ref Bank', accessor: (r) => r.externalReference || '-', align: 'center' },
            { header: 'No. Bayar', accessor: (r) => r.paymentNumber || '-', align: 'center' },
            { header: 'Santri', accessor: (r) => r.santriName || '-' },
            { header: 'Sistem', accessor: (r) => formatRupiah(r.internalAmount), align: 'right' },
            { header: 'Rekening Bank', accessor: (r) => formatRupiah(r.externalAmount), align: 'right' },
            { header: 'Selisih', accessor: (r) => formatRupiah(r.discrepancyAmount), align: 'right' },
            { header: 'Tindakan', accessor: (r) => formatResolutionAction(r.resolutionAction), align: 'center' },
            { header: 'Penyelesai', accessor: (r) => r.resolvedByName || '-' },
          ]}
          data={reconciliationsData.items}
          orientation="landscape"
        />
      )}

      {isOpen && !isPrintViewAvailable && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-base font-bold text-slate-900">Data laporan belum siap dicetak</h2>
            <p className="mt-1 text-sm text-slate-600">
              Tunggu hingga data laporan selesai dimuat, lalu tekan <strong>Cetak / PDF</strong> kembali.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
