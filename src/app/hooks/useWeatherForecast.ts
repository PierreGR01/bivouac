import { useState, useEffect } from 'react';

export interface HourlyForecast {
  time: string;
  precipitation: number;
  precipitationProbability: number;
  snowfall: number;
}

export interface WeatherForecast {
  hourly: HourlyForecast[];
  next24h: number;
  next48h: number;
}

export function useWeatherForecast(lat: number, lng: number) {
  const [data, setData] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setData(null);

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lng.toFixed(4));
    url.searchParams.set('hourly', 'precipitation,precipitation_probability,snowfall');
    url.searchParams.set('models', 'meteofrance_arome_france');
    url.searchParams.set('forecast_days', '2');
    url.searchParams.set('timezone', 'Europe/Paris');

    fetch(url.toString())
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        const times: string[] = json.hourly?.time ?? [];
        const precip: number[] = json.hourly?.precipitation ?? [];
        const prob: number[] = json.hourly?.precipitation_probability ?? [];
        const snow: number[] = json.hourly?.snowfall ?? [];

        const hourly: HourlyForecast[] = times.map((t, i) => ({
          time: t,
          precipitation: precip[i] ?? 0,
          precipitationProbability: prob[i] ?? 0,
          snowfall: snow[i] ?? 0,
        }));

        const currentHourStr = new Date().toISOString().slice(0, 13);
        const futureHours = hourly.filter((h) => h.time >= currentHourStr);

        const next24h = futureHours
          .slice(0, 24)
          .reduce((s, h) => s + h.precipitation + h.snowfall, 0);
        const next48h = futureHours
          .slice(0, 48)
          .reduce((s, h) => s + h.precipitation + h.snowfall, 0);

        setData({ hourly, next24h, next48h });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lat, lng]);

  return { data, loading, error };
}
