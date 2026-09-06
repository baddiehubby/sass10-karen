"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

type Device = {
  id: string;
  platform: string | null;
  displayName: string | null;
  appVersion: string | null;
  status: "active" | "revoked";
  lastSeenAt: string | null;
  createdAt: string;
};

function deviceLabel(device: Device) {
  return device.displayName || (device.platform === "ios" ? "iPhone or iPad" : device.platform === "android" ? "Android device" : "Mobile device");
}

export function MobileDevicesPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/mobile/devices", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("load");
      const data = await response.json() as { devices?: Device[] };
      setDevices(data.devices ?? []);
    } catch {
      toast.error("Could not load connected devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(device: Device) {
    setRevoking(device.id);
    try {
      const response = await fetch("/api/mobile/devices", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: device.id }),
      });
      if (!response.ok) throw new Error("revoke");
      toast.success(`${deviceLabel(device)} disconnected`);
      await load();
    } catch {
      toast.error("Could not disconnect this device");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-white/70">Mobile devices</h2>
          <p className="mt-1 text-xs leading-5 text-white/35">
            Devices signed in to your companion. Disconnect anything you no longer recognize.
          </p>
        </div>
        <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-200/80">
          {devices.filter((device) => device.status === "active").length} active
        </span>
      </div>

      {loading ? (
        <p className="mt-5 text-xs text-white/35">Checking secure connections…</p>
      ) : devices.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center">
          <p className="text-sm text-white/55">No mobile devices connected yet.</p>
          <p className="mt-1 text-xs text-white/30">Connect from the Buddie mobile app.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {devices.map((device) => {
            const active = device.status === "active";
            return (
              <li key={device.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-white/80">{deviceLabel(device)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-emerald-500/10 text-emerald-300" : "bg-white/5 text-white/35"}`}>
                      {active ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/30">
                    {device.platform ? `${device.platform === "ios" ? "iOS" : "Android"} · ` : ""}
                    {device.appVersion ? `v${device.appVersion} · ` : ""}
                    {device.lastSeenAt ? `Seen ${new Date(device.lastSeenAt).toLocaleDateString()}` : `Added ${new Date(device.createdAt).toLocaleDateString()}`}
                  </p>
                </div>
                {active ? (
                  <button
                    type="button"
                    disabled={revoking === device.id}
                    onClick={() => void revoke(device)}
                    className="shrink-0 rounded-full border border-rose-500/25 px-3 py-1.5 text-xs text-rose-200/80 transition hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    {revoking === device.id ? "Disconnecting…" : "Disconnect"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
