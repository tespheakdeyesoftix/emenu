export async function currentLocation() {
  if (!window.isSecureContext)
    throw new Error("Open this page over HTTPS or on localhost to use your current location.");
  if (!navigator.geolocation)
    throw new Error("This browser cannot access your location. Enter the coordinates manually.");

  return new Promise<GeolocationCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve(coords),
      ({ code }) => {
        const message = code === 1
          ? "Location access was denied. Allow it in your browser or enter the coordinates manually."
          : code === 3
            ? "Getting your location timed out. Try again or enter the coordinates manually."
            : "Your location is unavailable. Try again or enter the coordinates manually.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  });
}
