import * as React from "react";
import { Track } from "livekit-client";
import {
  MediaDeviceMenu,
  TrackToggle,
  useRoomContext,
} from "@livekit/components-react";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";

export interface SettingsMenuProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export function SettingsMenu(props: SettingsMenuProps) {
  const room = useRoomContext();

  const settings = React.useMemo(() => {
    return {
      media: {
        camera: true,
        microphone: true,
        label: "Media Devices",
        speaker: true,
      },
      effects: { label: "Effects" },
    };
  }, []);

  const tabs = React.useMemo(
    () =>
      Object.keys(settings).filter((t) => t !== undefined) as Array<
        keyof typeof settings
      >,
    [settings]
  );
  const [activeTab, setActiveTab] = React.useState(tabs[0]);

  const { isNoiseFilterEnabled, setNoiseFilterEnabled, isNoiseFilterPending } =
    useKrispNoiseFilter();

  React.useEffect(() => {
    // enable Krisp by default
    setNoiseFilterEnabled(true);
  }, []);

  return (
    <div className="settings-menu" style={{ width: "100%" }} {...props}>
      <div
        className="tabs"
        style={{ display: "flex", gap: "8px", marginBottom: "16px" }}
      >
        {tabs.map(
          (tab) =>
            settings[tab] && (
              <button
                className="tab lk-button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: tab === activeTab ? "#0f172a" : "#1e293b",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                aria-pressed={tab === activeTab}
              >
                {
                  // @ts-ignore
                  settings[tab].label
                }
              </button>
            )
        )}
      </div>
      <div className="tab-content">
        {activeTab === "media" && (
          <>
            {settings.media && settings.media.camera && (
              <>
                <h3>Camera</h3>
                <section
                  className="lk-button-group"
                  style={{ display: "flex", marginBottom: "16px" }}
                >
                  <TrackToggle source={Track.Source.Camera}>Camera</TrackToggle>
                  <div className="lk-button-group-menu">
                    <MediaDeviceMenu kind="videoinput" />
                  </div>
                </section>
              </>
            )}
            {settings.media && settings.media.microphone && (
              <>
                <h3>Microphone</h3>
                <section
                  className="lk-button-group"
                  style={{ display: "flex", marginBottom: "16px" }}
                >
                  <TrackToggle source={Track.Source.Microphone}>
                    Microphone
                  </TrackToggle>
                  <div className="lk-button-group-menu">
                    <MediaDeviceMenu kind="audioinput" />
                  </div>
                </section>
              </>
            )}
            {settings.media && settings.media.speaker && (
              <>
                <h3>Speaker & Headphones</h3>
                <section
                  className="lk-button-group"
                  style={{ display: "flex", marginBottom: "16px" }}
                >
                  <span
                    className="lk-button"
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#1e293b",
                      color: "white",
                      borderRadius: "4px",
                    }}
                  >
                    Audio Output
                  </span>
                  <div className="lk-button-group-menu">
                    <MediaDeviceMenu kind="audiooutput"></MediaDeviceMenu>
                  </div>
                </section>
              </>
            )}
          </>
        )}
        {activeTab === "effects" && (
          <>
            <h3>Audio</h3>
            <section>
              <label htmlFor="noise-filter" style={{ marginRight: "8px" }}>
                {" "}
                Enhanced Noise Cancellation
              </label>
              <input
                type="checkbox"
                id="noise-filter"
                checked={isNoiseFilterEnabled}
                disabled={isNoiseFilterPending}
                onChange={(e) => setNoiseFilterEnabled(e.target.checked)}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
