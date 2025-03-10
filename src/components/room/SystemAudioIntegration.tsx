import React, { useCallback, useState, useEffect } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { LocalAudioTrack, Track, LocalTrackPublication } from "livekit-client";
import SystemAudioCapture from "../SystemAudioCapture";

const SystemAudioIntegration: React.FC = () => {
  const { localParticipant } = useLocalParticipant();
  const [isSystemAudioActive, setIsSystemAudioActive] = useState(false);
  const [microphoneTrackPublication, setMicrophoneTrackPublication] =
    useState<LocalTrackPublication | null>(null);

  // Store the original microphone track when we first replace it
  useEffect(() => {
    if (localParticipant && !microphoneTrackPublication) {
      // Find the microphone track publication
      const micPublication = localParticipant
        .getTrackPublications()
        .find((pub) => pub.source === Track.Source.Microphone) as
        | LocalTrackPublication
        | undefined;

      if (micPublication) {
        setMicrophoneTrackPublication(micPublication);
      }
    }
  }, [localParticipant, microphoneTrackPublication]);

  // Handle system audio track creation
  const handleSystemAudioTrack = useCallback(
    async (track: LocalAudioTrack) => {
      console.log("System audio track created");

      // If we have a local participant, publish the track
      if (localParticipant) {
        try {
          // First, unpublish the microphone track if it exists
          const micPublication = localParticipant
            .getTrackPublications()
            .find((pub) => pub.source === Track.Source.Microphone) as
            | LocalTrackPublication
            | undefined;

          if (micPublication && micPublication.track) {
            console.log("Unpublishing microphone track");
            await localParticipant.unpublishTrack(micPublication.track);
            setMicrophoneTrackPublication(micPublication);
          }

          // Then publish the system audio track as a microphone source
          console.log("Publishing system audio track");
          await localParticipant.publishTrack(track, {
            name: "System Audio",
            source: Track.Source.Microphone,
          });

          setIsSystemAudioActive(true);
        } catch (err) {
          console.error("Error publishing system audio track:", err);
        }
      } else {
        console.warn(
          "No local participant available to publish system audio track"
        );
      }
    },
    [localParticipant]
  );

  // Handle when system audio capture is stopped
  const handleCaptureStateChange = useCallback(
    async (isCapturing: boolean) => {
      // If system audio is stopped and we have the original microphone track, republish it
      if (
        !isCapturing &&
        isSystemAudioActive &&
        microphoneTrackPublication &&
        localParticipant
      ) {
        try {
          console.log(
            "System audio stopped, republishing original microphone track"
          );

          // Unpublish all microphone tracks first
          const currentMicPublications = localParticipant
            .getTrackPublications()
            .filter((pub) => pub.source === Track.Source.Microphone);

          // Instead of trying to unpublish each track individually,
          // we'll disable the microphone which will unpublish all microphone tracks
          await localParticipant.setMicrophoneEnabled(false);

          // Then republish the original microphone track
          if (microphoneTrackPublication.track) {
            await localParticipant.publishTrack(
              microphoneTrackPublication.track,
              {
                name: microphoneTrackPublication.trackName,
                source: Track.Source.Microphone,
              }
            );
          }

          setIsSystemAudioActive(false);
        } catch (err) {
          console.error("Error republishing microphone track:", err);
        }
      }
    },
    [localParticipant, isSystemAudioActive, microphoneTrackPublication]
  );

  return (
    <SystemAudioCapture
      onAudioTrackCreated={handleSystemAudioTrack}
      onCaptureStateChange={handleCaptureStateChange}
    />
  );
};

export default SystemAudioIntegration;
