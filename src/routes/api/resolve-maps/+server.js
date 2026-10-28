import { json } from '@sveltejs/kit';

/**
 * Helper untuk mengekstrak latitude dan longitude dari string URL atau text koordinat
 * @param {string} text
 * @returns {{ lat: number, lng: number } | null}
 */
function extractCoordsFromUrl(text) {
  if (!text) return null;

  // Format 1: Koordinat langsung misal "-6.2088, 106.8456" atau "-6.2088,106.8456"
  const rawCoords = text.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (rawCoords) {
    const lat = parseFloat(rawCoords[1]);
    const lng = parseFloat(rawCoords[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Format 2: URL @lat,lng misal ".../@-6.2087634,106.845599,17z/..."
  const atCoords = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atCoords) {
    return { lat: parseFloat(atCoords[1]), lng: parseFloat(atCoords[2]) };
  }

  // Format 3: Query param ?q=lat,lng atau &q=lat,lng atau ?ll=lat,lng
  const queryCoords = text.match(/[?&](?:q|ll|query|center)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryCoords) {
    return { lat: parseFloat(queryCoords[1]), lng: parseFloat(queryCoords[2]) };
  }

  // Format 4: Google Maps data parameter !3d(lat)!4d(lng)
  const dataCoordsLat = text.match(/!3d(-?\d+\.\d+)/);
  const dataCoordsLng = text.match(/!4d(-?\d+\.\d+)/);
  if (dataCoordsLat && dataCoordsLng) {
    return { lat: parseFloat(dataCoordsLat[1]), lng: parseFloat(dataCoordsLng[1]) };
  }

  // Format 5: Link ftid / place coordinates
  const ftidCoords = text.match(/\/place\/[^/]+\/(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (ftidCoords) {
    return { lat: parseFloat(ftidCoords[1]), lng: parseFloat(ftidCoords[2]) };
  }

  return null;
}

export async function POST({ request, locals }) {
  const { user, profile } = await locals.safeGetSession();
  if (!user || !profile || !['administrator', 'pemilik', 'admin_hr'].includes(profile.role)) {
    return json({ success: false, message: 'Akses ditolak.' }, { status: 403 });
  }

  try {
    const { url } = await request.json();
    const inputUrl = String(url || '').trim();

    if (!inputUrl) {
      return json({ success: false, message: 'URL atau teks koordinat tidak boleh kosong.' }, { status: 400 });
    }

    // 1. Coba parse langsung jika sudah berupa URL panjang atau format koordinat
    let coords = extractCoordsFromUrl(inputUrl);
    if (coords) {
      return json({ success: true, ...coords });
    }

    // 2. Jika merupakan URL shortlink seperti maps.app.goo.gl / goo.gl/maps, follow redirect
    if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) {
      try {
        const response = await fetch(inputUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        const finalUrl = response.url;
        coords = extractCoordsFromUrl(finalUrl);

        if (coords) {
          return json({ success: true, ...coords, resolvedUrl: finalUrl });
        }

        // Coba cari di body jika URL tidak mencantumkan di path tapi ada di meta/content
        const html = await response.text();
        coords = extractCoordsFromUrl(html);
        if (coords) {
          return json({ success: true, ...coords });
        }
      } catch (fetchErr) {
        console.warn('Gagal follow redirect Google Maps link:', fetchErr);
      }
    }

    return json(
      {
        success: false,
        message: 'Gagal mengekstrak koordinat dari link Google Maps yang diberikan. Pastikan tautan valid.'
      },
      { status: 400 }
    );
  } catch (err) {
    return json({ success: false, message: 'Terjadi kesalahan pada server saat memproses tautan.' }, { status: 500 });
  }
}
