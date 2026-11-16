import khmerNewYearUrl from "./menu-patterns/khmer-new-year.svg?no-inline";
import pchumBenUrl from "./menu-patterns/pchum-ben.svg?no-inline";
import waterFestivalUrl from "./menu-patterns/water-festival.svg?no-inline";
import visakBocheaUrl from "./menu-patterns/visak-bochea.svg?no-inline";
import riceHarvestUrl from "./menu-patterns/rice-harvest.svg?no-inline";
import khmerHeritageUrl from "./menu-patterns/khmer-heritage.svg?no-inline";

export const culturalMenuPatterns = [
  {
    id: "khmer-new-year",
    name: "Khmer New Year",
    nameKm: "បុណ្យចូលឆ្នាំខ្មែរ",
    assetUrl: khmerNewYearUrl,
    tileSize: 128,
  },
  {
    id: "pchum-ben",
    name: "Pchum Ben",
    nameKm: "បុណ្យភ្ជុំបិណ្ឌ",
    assetUrl: pchumBenUrl,
    tileSize: 128,
  },
  {
    id: "water-festival",
    name: "Water & Moon Festival",
    nameKm: "អុំទូក និងសំពះព្រះខែ",
    assetUrl: waterFestivalUrl,
    tileSize: 144,
  },
  {
    id: "visak-bochea",
    name: "Visak Bochea",
    nameKm: "បុណ្យវិសាខបូជា",
    assetUrl: visakBocheaUrl,
    tileSize: 128,
  },
  {
    id: "rice-harvest",
    name: "Rice Harvest",
    nameKm: "រដូវប្រមូលផល",
    assetUrl: riceHarvestUrl,
    tileSize: 128,
  },
  {
    id: "khmer-heritage",
    name: "Khmer Heritage",
    nameKm: "កេរដំណែលខ្មែរ",
    assetUrl: khmerHeritageUrl,
    tileSize: 112,
  },
] as const;

export type CulturalMenuPatternId = (typeof culturalMenuPatterns)[number]["id"];

export function getCulturalMenuPattern(pattern: string) {
  return culturalMenuPatterns.find((item) => item.id === pattern);
}

export function isCulturalMenuPattern(
  pattern: string,
): pattern is CulturalMenuPatternId {
  return Boolean(getCulturalMenuPattern(pattern));
}
