export function calcCenter(bbox) {
  return {
    lng: (bbox[0][0] + bbox[1][0]) / 2,
    lat: (bbox[0][1] + bbox[1][1]) / 2
  };
}
