import React, { useEffect, useMemo, useRef } from "react";

type CallMode = "voice" | "video";
type CallPhase = "outgoing" | "incoming" | "connecting" | "active" | "ended";

export type CallScreenProps = {
  open: boolean;
  mode: CallMode;
  phase: CallPhase;

  peerName: string;
  peerAvatar?: string | null;

  // audio/video elements
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
  topLabel?: string; // e.g. "End-to-end encrypted"
  subtitle?: string; // e.g. "Connecting..."
};

const AvatarCircle: React.FC<{ src?: string | null; name: string }> = ({ src, name }) => {
  const initials = useMemo(() => {
    const parts = (name || "U").trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase()).join("").slice(0, 2) || "U";
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
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // attach streams
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [open, localStream, remoteStream]);

  if (!open) return null;

  const showVideo = mode === "video";
  const isIncoming = phase === "incoming";
  const isActive = phase === "active";
  const isConnecting = phase === "connecting" || phase === "outgoing";

  const sub =
    subtitle ||
    (phase === "incoming" ? "Incoming call…" : isActive ? "" : "Connecting…");

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Background */}
      <div
        className={[
          "absolute inset-0",
          showVideo ? "bg-black" : "bg-gradient-to-b from-[#1b1f25] via-[#b08d7a] to-[#e07a45]",
        ].join(" ")}
      />

      {/* Remote video (full) */}
      {showVideo && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Top label */}
      <div className="absolute top-9 left-0 right-0 flex items-center justify-center">
        <div className="text-white/80 text-[13px] tracking-wide">
          {topLabel}
        </div>
      </div>

      {/* Center info (WhatsApp style) */}
      <div className="absolute top-[90px] left-0 right-0 flex flex-col items-center px-5">
        <AvatarCircle src={peerAvatar} name={peerName} />
        <div className="mt-5 text-white text-[34px] font-extrabold text-center leading-tight drop-shadow">
          {peerName}
        </div>
        {!!sub && (
          <div className="mt-2 text-white/80 text-[18px] font-medium">
            {sub}
          </div>
        )}
      </div>

      {/* Local self-view (video only) */}
      {showVideo && (
        <div className="absolute top-20 right-4 w-[105px] h-[160px] rounded-2xl overflow-hidden border border-white/15 bg-black/40 shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-10 left-0 right-0 px-6">
        {/* Incoming: show accept/decline */}
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

        {/* Small helper text */}
        {isConnecting && (
          <div className="mt-6 text-center text-white/70 text-[12px]">
            If it doesn’t connect, it may need TURN later (we can add it).
          </div>
        )}
      </div>
    </div>
  );
};
