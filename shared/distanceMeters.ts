export function distanceMeters(
  latitude: number,
  longitude: number,
  customerLatitude: number,
  customerLongitude: number,
) {
  const radians = Math.PI / 180;
  const haversine =
    Math.sin(((customerLatitude - latitude) * radians) / 2) ** 2 +
    Math.cos(latitude * radians) *
      Math.cos(customerLatitude * radians) *
      Math.sin(((customerLongitude - longitude) * radians) / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}
