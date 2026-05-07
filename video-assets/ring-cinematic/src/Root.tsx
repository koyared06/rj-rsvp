import "./index.css";
import { Composition } from "remotion";
import {
  WeddingRingCinematic,
  WeddingRingFromReference,
  WeddingRingVertical,
} from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WeddingRingCinematic"
        component={WeddingRingCinematic}
        durationInFrames={240}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="WeddingRingVertical"
        component={WeddingRingVertical}
        durationInFrames={192}
        fps={24}
        width={720}
        height={1280}
      />
      <Composition
        id="WeddingRingFromReference"
        component={WeddingRingFromReference}
        durationInFrames={192}
        fps={24}
        width={720}
        height={1280}
      />
    </>
  );
};
