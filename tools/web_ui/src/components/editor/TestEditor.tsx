import React from "react";
import { useCurriculum } from "../../context/CurriculumContext";
import { FormHeader } from "./FormHeader";
import { LessonCard } from "./LessonCard";
import { TrackVehicleSection } from "./TrackVehicleSection";
import { SplineCanvas } from "./SplineCanvas";
import { StartModeCard } from "./StartModeCard";
import { TargetTimesCard } from "./TargetTimesCard";
import { api } from "../../api/client";

interface Props {
  onShowToast: (msg: string, type?: "info" | "success" | "error") => void;
  onBack?: () => void;
}

export const TestEditor: React.FC<Props> = ({ onShowToast, onBack }) => {
  const {
    activeTest,
    tracks,
    cars,
    currentSpline,
    updateActiveTest,
    saveActiveTier,
    deleteActiveTest,
    isSaving,
  } = useCurriculum();

  if (!activeTest) {
    return (
      <main className="editor-pane">
        <div className="empty-state">
          <h3>No Test Selected</h3>
          <p>Select a test from the left panel to inspect or edit.</p>
        </div>
      </main>
    );
  }

  const recalculateTelemetry = async (overrides: Partial<typeof activeTest> = {}) => {
    const merged = { ...activeTest, ...overrides };
    if (!merged.track_id || !merged.car_id) return;
    const layout = merged.track_layout || "";
    const startS = merged.start_s ?? 0;
    const finishS = merged.finish_s ?? 1;
    const mode = merged.start_mode || "STANDING";
    const stopBox = Boolean(merged.with_stop_box);

    try {
      const [targets, speedInfo] = await Promise.all([
        api.calculateTargets(merged.track_id, layout, startS, finishS, merged.car_id, mode, stopBox).catch(() => null),
        mode !== "STANDING"
          ? api.calculateInitialSpeed(merged.track_id, layout, startS, merged.car_id).catch(() => null)
          : Promise.resolve(null),
      ]);

      const nextUpdates: Partial<typeof activeTest> = {};
      if (targets && targets.gold_seconds && targets.silver_seconds && targets.bronze_seconds) {
        nextUpdates.targets = targets;
      }
      if (speedInfo && speedInfo.telemetry_available && speedInfo.speed_kmh !== undefined) {
        nextUpdates.rolling_speed_kmh = speedInfo.speed_kmh;
        nextUpdates.initial_gear = speedInfo.initial_gear;
        nextUpdates.initial_rpm = speedInfo.initial_rpm;
        nextUpdates.spawn_offset_meters = speedInfo.spawn_offset_meters;
      }
      if (Object.keys(nextUpdates).length > 0) {
        updateActiveTest(nextUpdates);
      }
    } catch {
      // Ignore telemetry calculation errors when profile is absent
    }
  };

  const handleTrackChange = async (newTrackId: string) => {
    const patch = { track_id: newTrackId, track_layout: "" };
    updateActiveTest(patch);
    void recalculateTelemetry(patch);
  };

  const handleLayoutChange = (newLayout: string) => {
    const patch = { track_layout: newLayout };
    updateActiveTest(patch);
    void recalculateTelemetry(patch);
  };

  const handleCarChange = (newCarId: string) => {
    const patch = { car_id: newCarId };
    updateActiveTest(patch);
    void recalculateTelemetry(patch);
  };

  const handleSave = async () => {
    try {
      await saveActiveTier();
      onShowToast(`Saved ${activeTest.test_id} successfully!`, "success");
    } catch (err: any) {
      onShowToast(`Failed to save: ${err.message}`, "error");
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete test ${activeTest.test_id}: "${activeTest.title}"?`)) {
      await deleteActiveTest();
      onShowToast(`Deleted test ${activeTest.test_id}`, "info");
    }
  };

  const handleRunDemo = async () => {
    try {
      onShowToast(`Launching ${activeTest.test_id} in Assetto Corsa with AI demo...`, "info");
      await api.runLiveTest(activeTest.test_id);
    } catch (err: any) {
      onShowToast(`Launch failed: ${err.message}`, "error");
    }
  };

  return (
    <main className="editor-pane">
      <form
        id="test-form"
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        {/* Header: Badge + Watch AI Demo + Trashcan + Diskette */}
        <FormHeader
          testId={activeTest.test_id}
          isSaving={isSaving}
          onBack={onBack}
          onRunDemo={handleRunDemo}
          onDeleteTest={handleDelete}
          onSaveTest={handleSave}
        />

        {/* Section 1: Curriculum Lesson & Description */}
        <LessonCard
          title={activeTest.title || ""}
          description={activeTest.description || ""}
          onTitleChange={(title) => updateActiveTest({ title })}
          onDescriptionChange={(description) => updateActiveTest({ description })}
        />

        {/* Section 2: Track & Vehicle Selection (MUI Autocomplete) */}
        <TrackVehicleSection
          tracks={tracks}
          cars={cars}
          selectedTrackId={activeTest.track_id}
          selectedLayout={activeTest.track_layout || ""}
          selectedCarId={activeTest.car_id}
          onTrackChange={handleTrackChange}
          onLayoutChange={handleLayoutChange}
          onCarChange={handleCarChange}
        />

        {/* Section 3: Spline Canvas & Spatial Bounds */}
        <SplineCanvas
          spline={currentSpline}
          startS={activeTest.start_s ?? 0}
          finishS={activeTest.finish_s ?? 1}
          onStartChange={(start_s) => {
            updateActiveTest({ start_s });
            void recalculateTelemetry({ start_s });
          }}
          onFinishChange={(finish_s) => {
            updateActiveTest({ finish_s });
            void recalculateTelemetry({ finish_s });
          }}
        />

        {/* Section 4: Start Mode & Physics */}
        <StartModeCard
          startMode={activeTest.start_mode}
          withStopBox={Boolean(activeTest.with_stop_box)}
          rollingSpeedKmh={activeTest.rolling_speed_kmh}
          initialGear={activeTest.initial_gear}
          initialRpm={activeTest.initial_rpm}
          onStartModeChange={(start_mode) => {
            updateActiveTest({ start_mode });
            void recalculateTelemetry({ start_mode });
          }}
          onStopBoxToggle={(with_stop_box) => {
            updateActiveTest({ with_stop_box });
            void recalculateTelemetry({ with_stop_box });
          }}
        />

        {/* Section 5: Target Times */}
        <TargetTimesCard
          targets={activeTest.targets}
          onChange={(targets) => updateActiveTest({ targets })}
        />
      </form>
    </main>
  );
};
