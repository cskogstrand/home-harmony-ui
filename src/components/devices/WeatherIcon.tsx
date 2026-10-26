import { CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudHail, Sun, Moon, Wind } from "lucide-react";

const conditionIcons = { sunny: Sun, "clear-night": Moon, cloudy: Cloud, partlycloudy: CloudSun, rainy: CloudRain, pouring: CloudRain, snowy: CloudSnow, "snowy-rainy": CloudSnow, lightning: CloudLightning, "lightning-rainy": CloudLightning, windy: Wind, "windy-variant": Wind, fog: CloudFog, hail: CloudHail };

export function WeatherIcon({ condition, size = 24 }: { condition: string; size?: number }) {
  const Icon = conditionIcons[condition as keyof typeof conditionIcons] ?? CloudSun;
  return <Icon size={size} aria-hidden="true" />;
}
