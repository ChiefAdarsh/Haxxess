import { patients } from '../../config/patients'

const invoices = [
  { patient: patients[0], amount: 320, status: 'pending', date: 'Feb 19', desc: 'Consultation + labs' },
  { patient: patients[3], amount: 580, status: 'pending', date: 'Feb 20', desc: 'ECG + consultation' },
  { patient: patients[1], amount: 250, status: 'paid', date: 'Feb 17', desc: 'Post-op follow-up' },
  { patient: patients[2], amount: 180, status: 'paid', date: 'Feb 14', desc: 'Prenatal checkup' },
  { patient: patients[4], amount: 200, status: 'paid', date: 'Feb 10', desc: 'Annual physical' },
  { patient: patients[5], amount: 150, status: 'overdue', date: 'Feb 5', desc: 'BP consultation' },
]

const statusStyle = {
  paid: { bg: '#f0fdf4', color: '#16a34a' },
  pending: { bg: '#fefce8', color: '#ca8a04' },
  overdue: { bg: '#fef2f2', color: '#dc2626' },
}

export default function BillingView() {
  const total = invoices.reduce((s, i) => s + i.amount, 0)
  const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const outstanding = total - paid

  return (
    <div>
      {/* summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Billed', value: `$${total}`, color: '#1f2937' },
          { label: 'Paid', value: `$${paid}`, color: '#16a34a' },
          { label: 'Outstanding', value: `$${outstanding}`, color: '#dc2626' },
        ].map((card) => (
          <div key={card.label} style={{
            backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
            padding: '20px',
          }}>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{card.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: card.color, margin: '4px 0 0' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* invoices table */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['Patient', 'Description', 'Date', 'Amount', 'Status'].map((h) => (
                <th key={h} style={{
                  textAlign: 'left', padding: '12px 16px',
                  fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => {
              const st = statusStyle[inv.status as keyof typeof statusStyle]
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1f2937' }}>{inv.patient.name}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{inv.desc}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{inv.date}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1f2937' }}>${inv.amount}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      backgroundColor: st.bg, color: st.color,
                    }}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
