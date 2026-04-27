import React from "react";
import { Composition } from "remotion";
import { loadFont as loadGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { FitVideo } from "./FitVideo";
import { OotdVideo } from "./OotdVideo";
import { DiscoverVideo } from "./DiscoverVideo";
import { FitMobileVideo } from "./FitMobileVideo";
import { OotdMobileVideo } from "./OotdMobileVideo";
import { DiscoverMobileVideo } from "./DiscoverMobileVideo";

loadGrotesk("normal", { weights: ["400", "700"], subsets: ["latin"] });
loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="fit" component={FitVideo} durationInFrames={900} fps={30} width={1920} height={1080} />
    <Composition id="ootd" component={OotdVideo} durationInFrames={900} fps={30} width={1920} height={1080} />
    <Composition id="discover" component={DiscoverVideo} durationInFrames={900} fps={30} width={1920} height={1080} />
    <Composition id="fit-mobile" component={FitMobileVideo} durationInFrames={900} fps={30} width={1080} height={1920} />
    <Composition id="ootd-mobile" component={OotdMobileVideo} durationInFrames={900} fps={30} width={1080} height={1920} />
    <Composition id="discover-mobile" component={DiscoverMobileVideo} durationInFrames={900} fps={30} width={1080} height={1920} />
  </>
);
