export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");

  if (!q || q.length < 3) {
    return Response.json([], { status: 200 });
  }

  const nominatimUrl =
    `https://nominatim.openstreetmap.org/search` +
    `?format=json` +
    `&addressdetails=1` +
    `&limit=8` +
    `&q=${encodeURIComponent(q)}`;

  const res = await fetch(nominatimUrl, {
    headers: {
      // REQUIRED by OpenStreetMap policy
      "User-Agent": "UNERA-Social/1.0 (contact@unera.social)",
      "Accept-Language": "en",
    },
  });

  const data = await res.json();

  return Response.json(
    data.map((loc: any) => ({
      name: loc.display_name,
      lat: loc.lat,
      lon: loc.lon,
      city: loc.address?.city || loc.address?.town || loc.address?.village,
      country: loc.address?.country,
    }))
  );
};
