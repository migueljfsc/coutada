/**
 * The user's position: `watchPosition` with high accuracy, plus the compass where the device has
 * one (iOS asks permission from a tap). Heading is the compass when present, else the GPS course
 * while moving (architecture §8).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Fix } from "./me";

export type LocationStatus = "off" | "asking" | "on" | "denied" | "unavailable";

/** Below this speed the GPS course is noise. */
const MOVING_MPS = 0.5;

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>("off");
  const [fix, setFix] = useState<Fix | null>(null);
  const watch = useRef<number | null>(null);
  const compass = useRef<number | null>(null);

  const onOrientation = useCallback((e: Event) => {
    const o = e as CompassEvent;
    if (typeof o.webkitCompassHeading === "number") compass.current = o.webkitCompassHeading;
    else if (o.absolute && typeof o.alpha === "number") compass.current = (360 - o.alpha) % 360;
    else return;
    setFix((f) => (f ? { ...f, heading: compass.current } : f));
  }, []);

  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    compass.current = null;
    window.removeEventListener("deviceorientationabsolute", onOrientation);
    window.removeEventListener("deviceorientation", onOrientation);
    setFix(null);
    setStatus("off");
  }, [onOrientation]);

  const start = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("asking");

    const permission = (DeviceOrientationEvent as unknown as OrientationPermission).requestPermission;
    try {
      if (!permission || (await permission()) === "granted") {
        window.addEventListener("deviceorientationabsolute", onOrientation);
        window.addEventListener("deviceorientation", onOrientation);
      }
    } catch {
      // The compass is optional; the position works without it.
    }

    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        const { longitude, latitude, accuracy, heading, speed } = p.coords;
        const course = speed !== null && speed > MOVING_MPS && heading !== null && !Number.isNaN(heading) ? heading : null;
        setFix({ at: [longitude, latitude], accuracy, heading: compass.current ?? course, time: p.timestamp });
        setStatus("on");
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          stop();
          setStatus("denied");
        } else {
          setStatus((s) => (s === "on" ? s : "unavailable"));
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 30_000 },
    );
  }, [onOrientation, stop]);

  useEffect(() => stop, [stop]);

  return { status, fix, start, stop };
}
