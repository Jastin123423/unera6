// components/CallScreen.tsx
import React, { useEffect, useRef } from "react";

interface CallScreenProps {
  open: boolean;
  mode: "voice" | "video";
  phase: "outgoing" | "incoming" | "connecting" | "active" | "ended";
  peerName: string;
  peerAvatar: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  speakerOn: boolean;
  onHangup: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleSpeaker: () => void;
}

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
  onHangup,
  onToggleMic,
  onToggleCam,
  onToggleSpeaker,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!open) return null;

  const getPhaseText = () => {
    switch (phase) {
      case "outgoing": return "Calling...";
      case "incoming": return "Incoming call...";
      case "connecting": return "Connecting...";
      case "active": return "Connected";
      case "ended": return "Call ended";
      default: return "";
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black flex flex-col">
      {/* Remote video (full screen) */}
      {mode === "video" && (
        <div className="absolute inset-0 bg-gray-900">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-[#3A3B3C] mx-auto mb-4 flex items-center justify-center">
                  {peerAvatar ? (
                    <img src={peerAvatar} alt={peerName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-3xl text-white">{peerName?.charAt(0) || 'U'}</span>
                  )}
                </div>
                <div className="text-white text-xl">{peerName}</div>
                <div className="text-gray-400 mt-2">{getPhaseText()}</div>
              </div>
            </div>
          )}

          {/* Local video (picture-in-picture) */}
          {localStream && (
            <div className="absolute bottom-24 right-4 w-32 h-48 rounded-lg overflow-hidden border-2 border-white shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      )}

      {/* Voice mode UI */}
      {mode === "voice" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-[#3A3B3C] mb-6 flex items-center justify-center">
            {peerAvatar ? (
              <img src={peerAvatar} alt={peerName} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-4xl text-white">{peerName?.charAt(0) || 'U'}</span>
            )}
          </div>
          
          <div className="text-white text-2xl font-semibold mb-2">{peerName}</div>
          <div className="text-gray-400 text-lg mb-12">{getPhaseText()}</div>

          {/* End-to-end encrypted indicator */}
          <div className="text-gray-500 text-sm mb-8 flex items-center gap-2">
            <i className="fas fa-lock text-xs" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      )}

      {/* Call controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-10">
        <div className="flex items-center justify-center gap-6">
          {/* Mute button */}
          <button
            onClick={onToggleMic}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              micOn ? 'bg-[#3A3B3C] hover:bg-[#4a4b4c]' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <i className={`fas ${micOn ? 'fa-microphone' : 'fa-microphone-slash'} text-white text-xl`} />
          </button>

          {/* Camera button (video mode only) */}
          {mode === "video" && (
            <button
              onClick={onToggleCam}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                camOn ? 'bg-[#3A3B3C] hover:bg-[#4a4b4c]' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <i className={`fas ${camOn ? 'fa-video' : 'fa-video-slash'} text-white text-xl`} />
            </button>
          )}

          {/* Speaker button */}
          <button
            onClick={onToggleSpeaker}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              speakerOn ? 'bg-[#3A3B3C] hover:bg-[#4a4b4c]' : 'bg-[#1B74E4] hover:bg-[#1A6ED8]'
            }`}
          >
            <i className={`fas ${speakerOn ? 'fa-volume-up' : 'fa-volume-off'} text-white text-xl`} />
          </button>

          {/* Hang up button */}
          <button
            onClick={onHangup}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
          >
            <i className="fas fa-phone-slash text-white text-xl" />
          </button>
        </div>
      </div>

      {/* Close button for when call is ended */}
      {phase === "ended" && (
        <div className="absolute top-4 right-4">
          <button
            onClick={onHangup}
            className="px-4 py-2 bg-[#3A3B3C] text-white rounded-lg hover:bg-[#4a4b4c]"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
