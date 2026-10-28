import {num} from './format.js';
export const plotFraction = (offset, width) => Math.max(0, Math.min(1, (offset / width * 800 - 60) / 720));
export function tracePath(rows, get, x, y, baseline = 0) {
  // Sparse live reports omit unchanged fields; only explicit nulls represent gaps.
  const points = rows.filter(r => get(r) !== undefined);
  const intervals = points.slice(1).map((r,i) => r.timestamp-points[i].timestamp).filter(v=>v>0).sort((a,b)=>a-b);
  // The upper cadence retains coarse historical buckets beside dense live samples.
  const cadence = Math.max(baseline, intervals[Math.floor((intervals.length-1)*0.9)] || 60000);
  let open=false, prev=0;
  return points.map(r=>{const v=num(get(r));if(v===null){open=false;return '';}
    if(r.timestamp-prev>cadence*3)open=false;
    const p=`${open?'L':'M'}${x(r.timestamp).toFixed(2)},${y(v).toFixed(2)}`;open=true;prev=r.timestamp;return p;
  }).join(' ');
}

export function historyCadence(rows) {
 const times=[...new Set(rows.map(r=>Number(r.timestamp)).filter(Number.isFinite))].sort((a,b)=>a-b);
 const gaps=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
 return gaps[Math.floor(gaps.length/2)] || 60000;
}
