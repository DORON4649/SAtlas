import { useEffect, useState } from 'react';
import { Cloud, CloudLightning, CloudRain, MapPin, Snowflake, Sun } from 'lucide-react';
import WidgetHeader from './WidgetHeader';

// 都道府県マスタ（緯度・経度）
const PREFECTURES: Record<string, { name: string; lat: number; lon: number }> = {
  chiba: { name: '千葉県', lat: 35.6074, lon: 140.1065 },
  tokyo: { name: '東京都', lat: 35.6895, lon: 139.6917 },
  kanagawa: { name: '神奈川県', lat: 35.4478, lon: 139.6425 },
  saitama: { name: '埼玉県', lat: 35.8574, lon: 139.6489 },
  ibaraki: { name: '茨城県', lat: 36.3418, lon: 140.4468 },
  osaka: { name: '大阪府', lat: 34.6863, lon: 135.52 },
};

interface Weather {
  temp: number;
  humidity: number;
  code: number;
  max: number;
  min: number;
}

// WMO天気コード → アイコン＆テキスト
const weatherInfo = (code: number) => {
  if (code === 0) return { label: '快晴', icon: <Sun className="h-8 w-8 text-amber-400" /> };
  if (code <= 3) return { label: '晴れ / 曇り', icon: <Cloud className="h-8 w-8 text-sky-300" /> };
  if (code >= 51 && code <= 67) return { label: '雨', icon: <CloudRain className="h-8 w-8 text-blue-400" /> };
  if (code >= 71 && code <= 77) return { label: '雪', icon: <Snowflake className="h-8 w-8 text-cyan-200" /> };
  if (code >= 95) return { label: '雷雨', icon: <CloudLightning className="h-8 w-8 text-yellow-400" /> };
  return { label: '曇り', icon: <Cloud className="h-8 w-8 text-slate-300" /> };
};

export default function WeatherWidget({ isEditing }: { isEditing: boolean }) {
  const [prefKey, setPrefKey] = useState(() => localStorage.getItem('satlas_weather_pref') ?? 'chiba');
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    const pref = PREFECTURES[prefKey] ?? PREFECTURES.chiba;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${pref.lat}&longitude=${pref.lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo`;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((data) =>
        setWeather({
          temp: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          code: data.current.weather_code,
          max: data.daily.temperature_2m_max[0],
          min: data.daily.temperature_2m_min[0],
        }),
      )
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('天気取得エラー:', err);
      });
    return () => ctrl.abort();
  }, [prefKey]);

  const changePref = (key: string) => {
    setPrefKey(key);
    localStorage.setItem('satlas_weather_pref', key);
  };

  return (
    <>
      <WidgetHeader icon={<MapPin className="h-3.5 w-3.5 text-blue-400" />} title="天気予報 (Open-Meteo)" isEditing={isEditing}>
        <select
          value={prefKey}
          onChange={(e) => changePref(e.target.value)}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
        >
          {Object.entries(PREFECTURES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.name}
            </option>
          ))}
        </select>
      </WidgetHeader>

      {weather ? (
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {weatherInfo(weather.code).icon}
            <div>
              <div className="text-2xl font-bold text-white">{weather.temp}°C</div>
              <div className="text-xs text-slate-400">{weatherInfo(weather.code).label}</div>
            </div>
          </div>
          <div className="space-y-1 text-right text-xs text-slate-400">
            <div>
              最高 <span className="font-semibold text-rose-400">{weather.max}°</span> / 最低{' '}
              <span className="font-semibold text-sky-400">{weather.min}°</span>
            </div>
            <div>湿度 {weather.humidity}%</div>
          </div>
        </div>
      ) : (
        <div className="mt-auto text-sm text-slate-500">天気データを取得中...</div>
      )}
    </>
  );
}
