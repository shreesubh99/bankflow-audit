export function formatINR(val: number | undefined | null, compact: boolean = false): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  
  if (compact) {
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (absVal >= 10000000) {
      return `${sign}₹${(absVal / 10000000).toFixed(2)} Cr`;
    }
    if (absVal >= 100000) {
      return `${sign}₹${(absVal / 100000).toFixed(2)} L`;
    }
    if (absVal >= 1000) {
      return `${sign}₹${(absVal / 1000).toFixed(1)} k`;
    }
  }

  const parts = val.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  const isNegative = integerPart.startsWith('-');
  if (isNegative) integerPart = integerPart.slice(1);

  // Indian Numbering System formatting (last 3, then groups of 2)
  let lastThree = integerPart.slice(-3);
  let otherNumbers = integerPart.slice(0, -3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}₹${formattedInt}${decimalPart !== '00' ? '.' + decimalPart : ''}`;
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return 'N/A';
  try {
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(m, 10) - 1;
    return `${d} ${months[mIdx] || m} ${y}`;
  } catch {
    return dateStr;
  }
}

export function getDirectionBadge(dir: string) {
  switch (dir) {
    case 'IN':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold';
    case 'OUT':
      return 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold';
    case 'INTERNAL':
      return 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold';
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'MATCH':
    case 'FULLY USED':
    case 'RESOLVED':
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold';
    case 'MISMATCH':
    case 'OVERSPENT':
    case 'OPEN':
    case 'HIGH':
    case 'FAILED':
      return 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold';
    case 'PARTIALLY USED':
    case 'REVIEW REQUIRED':
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-600 border border-gray-300 font-medium';
    case 'PROCESSING':
      return 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold animate-pulse';
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
}
