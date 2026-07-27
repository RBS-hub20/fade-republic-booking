"use client";

import { MapPin } from "lucide-react";

/**
 * A drawn stand-in for the pickup location.
 *
 * The MVP ships no map SDK (stack is locked), so this is an SVG street plan —
 * honest about being a sketch, precise about the coordinates it labels.
 */
export function MockMap({
  branch,
  address,
  coordinates,
  landmark,
}: {
  branch: string;
  address: string;
  coordinates: { lat: number; lng: number };
  landmark: string;
}) {
  return (
    <div className="relative h-44 w-full overflow-hidden rounded-xl border border-black/[0.08] bg-[#EEF3FA]">
      <svg
        viewBox="0 0 400 176"
        className="absolute inset-0 h-full w-full"
        aria-label={`Sketch map of ${branch}`}
        role="img"
      >
        <defs>
          <pattern id="eg-map-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="#D3DEEC" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="400" height="176" fill="#EEF3FA" />
        <rect width="400" height="176" fill="url(#eg-map-grid)" />

        {/* Arterial roads */}
        <path d="M0 118 H400" stroke="#FFFFFF" strokeWidth="14" />
        <path d="M0 118 H400" stroke="#C9D6E8" strokeWidth="1" />
        <path d="M244 0 V176" stroke="#FFFFFF" strokeWidth="11" />
        <path d="M244 0 V176" stroke="#C9D6E8" strokeWidth="1" />
        <path d="M0 46 H180 L244 46" stroke="#FFFFFF" strokeWidth="7" />

        {/* Blocks */}
        <rect x="28" y="60" width="86" height="42" rx="5" fill="#E1E9F5" />
        <rect x="126" y="60" width="70" height="42" rx="5" fill="#E1E9F5" />
        <rect x="272" y="18" width="96" height="72" rx="6" fill="#DCE6F4" />
        <rect x="272" y="132" width="70" height="32" rx="5" fill="#E1E9F5" />

        {/* Water */}
        <path d="M330 96 Q368 108 400 96 L400 176 L330 176 Z" fill="#D6E6F7" />

        <text x="292" y="58" fill="#7E93B2" fontSize="9" fontFamily="system-ui">
          SM City Cebu
        </text>
        <text x="34" y="86" fill="#8FA2BD" fontSize="8" fontFamily="system-ui">
          North Reclamation
        </text>
      </svg>

      {/* Pin */}
      <div className="absolute left-[62%] top-[38%] -translate-x-1/2 -translate-y-full">
        <span className="relative flex flex-col items-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-egov-red text-white shadow-lg shadow-black/25">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="mt-0.5 h-2 w-2 rotate-45 bg-egov-red" />
        </span>
      </div>

      <div className="absolute inset-x-2 bottom-2 rounded-lg border border-black/[0.06] bg-white/95 px-3 py-2 backdrop-blur">
        <p className="text-[13px] font-semibold leading-tight text-black/85">{branch}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-black/50">{address}</p>
        <p className="mt-0.5 text-[11px] text-black/40">
          {landmark} • {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
        </p>
      </div>

      <span className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/85">
        Sketch map
      </span>
    </div>
  );
}
