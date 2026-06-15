import { useState, useEffect, useRef } from 'react';

export interface NominatimResult {
  place_id: number;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  boundingbox: [string, string, string, string];
}

export function useNominatim(query: string) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', query.trim());
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '5');
        url.searchParams.set('accept-language', 'fr');
        url.searchParams.set('addressdetails', '0');

        const res = await fetch(url.toString(), {
          signal: abortRef.current.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'bivouac-app/1.0',
          },
        });

        if (!res.ok) throw new Error('Nominatim error');
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { suggestions, isLoading };
}
