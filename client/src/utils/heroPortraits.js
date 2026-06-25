export const HERO_PORTRAITS = {
  siegebreaker: '/hero/siegebreaker.webp',
  forge_lord: '/hero/forge_lord.webp',
  stonelord: '/hero/stonelord.webp',
  archmage: '/hero/archmage.webp',
  lunar_sentinel: '/hero/lunar_sentinel.webp',
  mage_king: '/hero/mage_king.webp',
  warlord: '/hero/warlord.webp',
  high_chieftain: '/hero/high_chieftain.webp',
  warshaman: '/hero/warshaman.webp',
  assassin: '/hero/assassin.webp',
  void_weaver: '/hero/void_weaver.webp',
  shadowmaster: '/hero/shadowmaster.webp',
  paladin: '/hero/paladin.webp',
  grand_chancellor: '/hero/grand_chancellor.webp',
  high_consul: '/hero/grand_chancellor.webp',
  alpha: '/hero/warlord.webp',
  storm_howler: '/hero/warshaman.webp',
  blood_shaman: '/hero/warshaman.webp',
  night_lord: '/hero/void_weaver.webp',
  sanguine_oracle: '/hero/shadowmaster.webp',
  blood_matriarch: '/hero/assassin.webp',
  _default: '/hero/siegebreaker.webp',
};

export function heroPortraitUrl(cls) {
  return HERO_PORTRAITS[cls] || HERO_PORTRAITS._default || '';
}