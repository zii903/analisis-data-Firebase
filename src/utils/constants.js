export const daysKeys = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const dayColors = {
  Senin: { planned: '#3B82F6', unplan: '#93C5FD', base: '#3B82F6' },
  Selasa: { planned: '#10B981', unplan: '#6EE7B7', base: '#10B981' },
  Rabu: { planned: '#F59E0B', unplan: '#FCD34D', base: '#EAB308' },
  Kamis: { planned: '#8B5CF6', unplan: '#C4B5FD', base: '#F97316' },
  Jumat: { planned: '#EC4899', unplan: '#F9A8D4', base: '#8B5CF6' },
  Sabtu: { planned: '#6366F1', unplan: '#A5B4FC', base: '#EC4899' },
  Minggu: { planned: '#EF4444', unplan: '#FCA5A5', base: '#EF4444' },
};

export const formatDurasi = (totalJam) => {
  if (!totalJam || totalJam <= 0) return '0 Jam';
  const jam = Math.floor(totalJam);
  const menit = Math.round((totalJam - jam) * 60);
  if (jam === 0) return `${menit} Menit`;
  if (menit === 0) return `${jam.toLocaleString('id-ID')} Jam`;
  return `${jam.toLocaleString('id-ID')} Jam ${menit} Menit`;
};
