// These live checks verify representative connections, not worldwide venue completeness.
const headers = {'User-Agent': 'Bopok/0.3 (+https://github.com/hundol047/SCV-hacktoon)'};
const geocodeOnly = process.argv.includes('--geocode-only');
async function json(response, phase) {
  if (!response.ok) throw Error(`${phase}_http_${response.status}`);
  try { return await response.json(); } catch { throw Error(`${phase}_invalid_json`); }
}
for (const region of ['Seoul, South Korea', 'Paris, France', 'New York, USA']) {
  let phase = 'geocode';
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({q: region, format: 'jsonv2', limit: '1', addressdetails: '1'});
    const locations = await json(await fetch(url, {headers, signal: AbortSignal.timeout(15000)}), phase);
    const city = locations[0];
    if (!city || !Number.isFinite(Number(city.lat)) || !Number.isFinite(Number(city.lon))) throw Error('geocode_invalid_coordinates');
    console.log(JSON.stringify({region, phase, verified: true, country: city.address?.country_code, checkedAt: new Date().toISOString()}));
    if (!geocodeOnly) {
      phase = 'places';
      const data = await json(await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', headers: {...headers, 'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({data: `[out:json][timeout:20];nwr(around:1000,${city.lat},${city.lon})["tourism"="museum"];out center tags 10;`}),
        signal: AbortSignal.timeout(30000),
      }), phase);
      if (!Array.isArray(data.elements)) throw Error('places_invalid_schema');
      console.log(JSON.stringify({region, phase, verified: true, places: data.elements.length, checkedAt: new Date().toISOString()}));
    }
  } catch (error) {
    console.error(JSON.stringify({region, phase, verified: false, code: error.cause?.code ?? error.message}));
    process.exitCode = 1;
  } finally {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
if (!geocodeOnly) {
  try {
    const data = await json(await fetch('https://api.frankfurter.dev/v1/latest', {signal: AbortSignal.timeout(15000)}), 'fx');
    if (!data.rates?.KRW || !data.rates?.USD) throw Error('fx_invalid_schema');
    console.log(JSON.stringify({phase: 'fx', verified: true, date: data.date, currencies: Object.keys(data.rates).length}));
  } catch (error) {
    console.error(JSON.stringify({phase: 'fx', verified: false, code: error.cause?.code ?? error.message}));
    process.exitCode = 1;
  }
}
