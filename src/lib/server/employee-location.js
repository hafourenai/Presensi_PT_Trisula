export function employeeLocation(formData) {
  const latitude = String(formData.get('work_lat') ?? '').trim();
  const longitude = String(formData.get('work_lng') ?? '').trim();
  const radius = String(formData.get('work_radius_m') ?? '').trim();
  if (Boolean(latitude) !== Boolean(longitude)) {
    throw new Error('Latitude dan Longitude harus diisi berpasangan atau dikosongkan keduanya.');
  }
  const work_lat = latitude ? Number(latitude) : null;
  const work_lng = longitude ? Number(longitude) : null;
  const work_radius_m = radius ? Number(radius) : null;
  if (work_lat !== null && (!Number.isFinite(work_lat) || work_lat < -90 || work_lat > 90)) {
    throw new Error('Latitude tidak valid.');
  }
  if (work_lng !== null && (!Number.isFinite(work_lng) || work_lng < -180 || work_lng > 180)) {
    throw new Error('Longitude tidak valid.');
  }
  if (work_radius_m !== null && (!Number.isInteger(work_radius_m) || work_radius_m <= 0)) {
    throw new Error('Radius harus berupa bilangan bulat positif.');
  }
  return { work_lat, work_lng, work_radius_m };
}
