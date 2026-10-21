// LINE Flex messages pushed to members (Thai copy, as in the loyalty design).
// Pushes can fail for non-friends; the LIFF card is the source of truth, so these are courtesy only.

const GREEN = '#06C755';
const INK = '#1C1814';
const MUTED = '#8A8580';
const RED = '#8E3522';

const baht = (satang: number) =>
  `฿${(satang / 100).toLocaleString('en-US', { minimumFractionDigits: satang % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

const when = (d: Date) =>
  d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });

const text = (t: string, extra: object = {}) => ({ type: 'text', text: t, wrap: true, size: 'sm', color: INK, ...extra });

const row = (left: string, right: string, extra: object = {}) => ({
  type: 'box',
  layout: 'horizontal',
  contents: [text(left, { flex: 3, ...extra }), text(right, { flex: 2, align: 'end', ...extra })],
});

function bubble(header: object[], body: object[], button?: { label: string; uri: string }) {
  return {
    type: 'bubble',
    header: { type: 'box', layout: 'vertical', backgroundColor: GREEN, paddingAll: '14px', contents: header },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
    ...(button && {
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'button', style: 'link', height: 'sm', color: GREEN, action: { type: 'uri', label: button.label, uri: button.uri } }],
      },
    }),
  };
}

export interface EarnMessageInput {
  shop: string;
  orderNumber: number;
  paidAt: Date;
  lines: { name: string; qty: number; totalSatang: number }[];
  discountSatang: number;
  totalSatang: number;
  points: number;
  balance: number;
  cardUrl: string;
}

// Receipt + points, after a member claims a receipt QR
export function earnMessage(m: EarnMessageInput) {
  const items = m.lines.map((l) => row(l.qty > 1 ? `${l.name} ×${l.qty}` : l.name, baht(l.totalSatang)));
  return {
    type: 'flex',
    altText: `+${m.points} แต้ม · ใบเสร็จ #${m.orderNumber}`,
    contents: bubble(
      [
        text(`ใบเสร็จ · #${m.orderNumber} · ${when(m.paidAt)}`, { size: 'xs', color: '#FFFFFF' }),
        text(m.shop, { weight: 'bold', size: 'md', color: '#FFFFFF' }),
      ],
      [
        ...items,
        ...(m.discountSatang > 0 ? [row('ส่วนลดรางวัล', `−${baht(m.discountSatang)}`, { color: GREEN })] : []),
        { type: 'separator', margin: 'md' },
        row('รวม', baht(m.totalSatang), { weight: 'bold' }),
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          paddingAll: '10px',
          cornerRadius: '8px',
          backgroundColor: '#E5F8EC',
          contents: [
            text(`+${m.points} แต้ม`, { weight: 'bold', color: '#0A7A3B' }),
            text(`ยอดรวม ${m.balance} แต้ม`, { size: 'xs', align: 'end', gravity: 'center' }),
          ],
        },
      ],
      { label: 'ดูบัตรสมาชิก', uri: m.cardUrl },
    ),
  };
}

// After a reward code is used on a paid order
export function redeemedMessage(m: { rewardName: string; cost: number; balance: number; orderNumber: number; at: Date; cardUrl: string }) {
  return {
    type: 'flex',
    altText: `แลกรางวัลสำเร็จ · ${m.rewardName}`,
    contents: bubble(
      [text('แลกรางวัลสำเร็จ', { weight: 'bold', size: 'md', color: '#FFFFFF' })],
      [
        text(m.rewardName, { weight: 'bold' }),
        row('ใช้แต้ม', `−${m.cost}`),
        row('คงเหลือ', `${m.balance} แต้ม`, { weight: 'bold' }),
        text(`ใบเสร็จ #${m.orderNumber} · ${when(m.at)}`, { size: 'xs', color: MUTED }),
      ],
      { label: 'ดูบัตรสมาชิก', uri: m.cardUrl },
    ),
  };
}

// After a refund reverses the points an order earned (and returns points a reward used)
export function reversalMessage(m: { orderNumber: number; delta: number; balance: number; cardUrl: string }) {
  const sign = m.delta > 0 ? '+' : '−';
  return {
    type: 'flex',
    altText: `ปรับยอดแต้ม · คำสั่งซื้อ #${m.orderNumber}`,
    contents: bubble(
      [text('ปรับยอดแต้ม', { weight: 'bold', size: 'md', color: '#FFFFFF' })],
      [
        text(`คำสั่งซื้อ #${m.orderNumber} ถูกยกเลิกโดยร้าน จึงปรับแต้มที่เกี่ยวกับคำสั่งซื้อนี้`),
        row('ปรับแต้ม', `${sign}${Math.abs(m.delta)}`, { weight: 'bold', color: m.delta < 0 ? RED : GREEN }),
        row('คงเหลือ', `${m.balance} แต้ม`),
      ],
      { label: 'ดูบัตรสมาชิก', uri: m.cardUrl },
    ),
  };
}
