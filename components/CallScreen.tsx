// components/CallScreen.tsx
import React, { useEffect, useMemo, useRef } from "react";

type CallMode = "voice" | "video";
type CallPhase = "outgoing" | "incoming" | "connecting" | "active" | "ended";

export type CallScreenProps = {
  open: boolean;
  mode: CallMode;
  phase: CallPhase;

  peerName: string;
  peerAvatar?: string | null;

  // streams
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;

  // toggles
  micOn: boolean;
  camOn: boolean;
  speakerOn: boolean;

  // actions
  onAccept?: () => void;
  onDecline?: () => void;
  onHangup: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleSpeaker: () => void;
  onFlipCamera?: () => void;

  // optional label
  topLabel?: string;
  subtitle?: string;

  // ✅ WhatsApp-style swap
  swapped?: boolean;        // when true: local is full-screen, remote is small
  onSwap?: () => void;      // tap full/small video to swap
};

const AvatarCircle: React.FC<{ src?: string | null; name: string }> = ({ src, name }) => {
  const initials = useMemo(() => {
    const parts = (name || "U").trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("").slice(0, 2) || "U";
  }, [name]);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="w-[92px] h-[92px] rounded-full object-cover border border-white/25 shadow-lg"
      />
    );
  }
  return (
    <div className="w-[92px] h-[92px] rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white text-3xl font-semibold shadow-lg">
      {initials}
    </div>
  );
};

const IconBtn: React.FC<{
  icon: string;
  onClick: () => void;
  danger?: boolean;
  muted?: boolean;
  label?: string;
}> = ({ icon, onClick, danger, muted, label }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-14 h-14 rounded-full flex items-center justify-center active:scale-[0.98] transition",
        danger ? "bg-[#ff3b30]" : "bg-black/35",
        muted ? "opacity-70" : "opacity-100",
      ].join(" ")}
      aria-label={label || icon}
    >
      <i className={`${icon} text-white text-[20px]`} />
    </button>
  );
};

export const CallScreen: React.FC<CallScreenProps> = ({
  open,
  mode,
  phase,
  peerName,
  peerAvatar,
  localStream,
  remoteStream,
  micOn,
  camOn,
  speakerOn,
  onAccept,
  onDecline,
  onHangup,
  onToggleMic,
  onToggleCam,
  onToggleSpeaker,
  onFlipCamera,
  topLabel = "End-to-end encrypted",
  subtitle,
  swapped = false,
  onSwap,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // ✅ critical for VOICE calls (and also works for video)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // attach local stream (for local preview / or full-screen when swapped)
  useEffect(() => {
    if (!open) return;
    const v = localVideoRef.current;
    if (v && localStream) {
      // @ts-ignore
      v.srcObject = localStream;
      v.muted = true; // never play local audio
      v.play?.().catch(() => {});
    }
  }, [open, localStream]);

  // attach remote stream to remote video element (video mode)
  useEffect(() => {
    if (!open) return;
    const v = remoteVideoRef.current;
    if (v && remoteStream) {
      // @ts-ignore
      v.srcObject = remoteStream;
      v.muted = false;
      v.volume = speakerOn ? 1 : 0;
      v.play?.().catch(() => {});
    }
  }, [open, remoteStream, speakerOn]);

  // ✅ attach remote stream to audio element (voice mode needs this)
  useEffect(() => {
    if (!open) return;
    const a = remoteAudioRef.current;
    if (a && remoteStream) {
      // @ts-ignore
      a.srcObject = remoteStream;
      a.muted = false;
      a.volume = speakerOn ? 1 : 0;
      a.play?.().catch(() => {});
    }
  }, [open, remoteStream, speakerOn]);

  if (!open) return null;

  const showVideo = mode === "video";
  const isIncoming = phase === "incoming";
  const isActive = phase === "active";
  const isConnecting = phase === "connecting" || phase === "outgoing";

  const sub = subtitle || (phase === "incoming" ? "Incoming call…" : isActive ? "" : "Connecting…");

  // WhatsApp-like: tap video (full or small) to swap
  const canSwap = showVideo && typeof onSwap === "function";

  // Full screen video element ref depends on swapped
  const fullRef = swapped ? localVideoRef : remoteVideoRef;
  const smallRef = swapped ? remoteVideoRef : localVideoRef;

  // In full-screen:
  // - If full is local => must be muted
  // - If full is remote => must not be muted (but remote audio is also on <audio>; that's fine)
  const fullMuted = swapped ? true : false;

  // In small preview:
  // - If small is local => muted
  // - If small is remote => not muted (still safe; remoteAudio handles sound)
  const smallMuted = swapped ? false : true;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* ✅ Required so VOICE calls can play audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Background */}
      <div
        className={[
          "absolute inset-0",
          showVideo ? "bg-black" : "bg-gradient-to-b from-[#1b1f25] via-[#b08d7a] to-[#e07a45]",
        ].join(" ")}
      />

      {/* Full screen video (swap capable) */}
      {showVideo && (
        <video
          ref={fullRef}
          autoPlay
          playsInline
          muted={fullMuted}
          className="absolute inset-0 w-full h-full object-cover"
          onClick={() => (canSwap ? onSwap?.() : undefined)}
        />
      )}

      {/* Top label */}
      <div className="absolute top-9 left-0 right-0 flex items-center justify-center">
        <div className="text-white/80 text-[13px] tracking-wide">{topLabel}</div>
      </div>

      {/* Center info (shown always; looks like WhatsApp) */}
      <div className="absolute top-[90px] left-0 right-0 flex flex-col items-center px-5 pointer-events-none">
        <AvatarCircle src={peerAvatar} name={peerName} />
        <div className="mt-5 text-white text-[34px] font-extrabold text-center leading-tight drop-shadow">
          {peerName}
        </div>
        {!!sub && <div className="mt-2 text-white/80 text-[18px] font-medium">{sub}</div>}
        {canSwap && (
          <div className="mt-2 text-white/60 text-[12px]">
            Tap video to swap view
          </div>
        )}
      </div>

      {/* Small preview (video only) */}
      {showVideo && (
        <div
          className="absolute top-20 right-4 w-[105px] h-[160px] rounded-2xl overflow-hidden border border-white/15 bg-black/40 shadow-lg"
          onClick={() => (canSwap ? onSwap?.() : undefined)}
          role={canSwap ? "button" : undefined}
          aria-label={canSwap ? "Swap view" : undefined}
        >
          <video
            ref={smallRef}
            autoPlay
            playsInline
            muted={smallMuted}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-10 left-0 right-0 px-6">
        {/* Incoming: accept/decline */}
        {isIncoming ? (
          <div className="flex items-center justify-between max-w-[360px] mx-auto">
            <IconBtn icon="fas fa-phone-slash" onClick={onDecline || onHangup} danger label="Decline" />
            <IconBtn icon="fas fa-phone" onClick={onAccept || (() => {})} label="Accept" />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-5 max-w-[430px] mx-auto">
            {/* video only */}
            {showVideo ? (
              <>
                <IconBtn
                  icon={camOn ? "fas fa-video" : "fas fa-video-slash"}
                  onClick={onToggleCam}
                  muted={!camOn}
                  label="Camera"
                />
                <IconBtn icon="fas fa-sync-alt" onClick={onFlipCamera || (() => {})} label="Flip camera" />
              </>
            ) : (
              <IconBtn
                icon={speakerOn ? "fas fa-volume-up" : "fas fa-volume-mute"}
                onClick={onToggleSpeaker}
                muted={!speakerOn}
                label="Speaker"
              />
            )}

            <IconBtn
              icon={micOn ? "fas fa-microphone" : "fas fa-microphone-slash"}
              onClick={onToggleMic}
              muted={!micOn}
              label="Mic"
            />

            <IconBtn icon="fas fa-phone-slash" onClick={onHangup} danger label="End call" />
          </div>
        )}

        {isConnecting && (
          <div className="mt-6 text-center text-white/70 text-[12px]">
            If it doesn’t connect, it may need TURN later (we can add it).
          </div>
        )}
      </div>
    </div>
  );
};
