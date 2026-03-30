import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type ServiceIllustrationKey =
  | 'autonomousMowing'
  | 'smartEdging'
  | 'cleanupDebris'
  | 'seasonalMaintenance'
  | 'performanceReporting';

interface IllustrationSceneProps {
  className?: string;
  decorative?: boolean;
  label?: string;
}

interface ServiceIllustrationProps extends IllustrationSceneProps {
  illustration: ServiceIllustrationKey;
}

interface SceneFrameProps extends IllustrationSceneProps {
  children: ReactNode;
  illustration: ServiceIllustrationKey;
}

const INK = '#101713';
const PAPER = '#FBF8F2';
const PAPER_EDGE = '#DED8CB';
const PANEL = '#F3EDE2';
const PANEL_BLOB = '#FEF5D9';
const PANEL_MINT = '#EAF4E7';
const GRASS_LIGHT = '#BDE59A';
const GRASS_MID = '#8BCD72';
const GRASS_DARK = '#5E9F57';
const BRAND = '#329F5B';
const BRAND_SOFT = '#77C77D';
const BRAND_WASH = '#D6EDD6';
const SAND = '#E7D9C5';
const SAND_EDGE = '#D2C0A2';
const SKY = '#DDEAF2';
const GOLD = '#F0D27B';
const GOLD_DEEP = '#E1AF58';
const MULCH = '#D5B186';
const SHADOW = 'rgba(16, 23, 19, 0.12)';
const LIGHT_SHADOW = 'rgba(16, 23, 19, 0.08)';

const strokeProps = {
  fill: 'none',
  stroke: INK,
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

const SceneFrame = ({ children, className, decorative = true, illustration, label }: SceneFrameProps) => (
  <svg
    viewBox="0 0 320 200"
    className={cn('h-full w-full', className)}
    xmlns="http://www.w3.org/2000/svg"
    role={decorative ? undefined : 'img'}
    aria-hidden={decorative ? true : undefined}
    aria-label={decorative ? undefined : label}
    data-service-illustration={illustration}
  >
    <rect width="320" height="200" rx="28" fill={PANEL} />
    <circle cx="58" cy="42" r="30" fill={PANEL_BLOB} />
    <circle cx="262" cy="36" r="24" fill={PANEL_MINT} />
    <path
      d="M12 150C47 132 86 128 128 138C172 149 212 160 258 153C279 149 296 143 308 136V182C308 189.732 301.732 196 294 196H26C18.268 196 12 189.732 12 182V150Z"
      fill="rgba(255,255,255,0.42)"
    />
    <rect x="10" y="10" width="300" height="180" rx="22" fill={PAPER} stroke={PAPER_EDGE} />
    {children}
  </svg>
);

const LawnPatch = ({
  x,
  y,
  width,
  height,
  rotation = 0
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}) => (
  <g transform={`translate(${x} ${y}) rotate(${rotation})`}>
    <ellipse cx={width / 2} cy={height + 9} rx={width * 0.38} ry={11} fill={LIGHT_SHADOW} />
    <rect width={width} height={height} rx={18} fill={GRASS_LIGHT} stroke={INK} strokeWidth={3} />
    <path d={`M12 ${height - 6}C28 ${height - 20} 44 ${height - 22} 58 ${height - 8}`} fill={GRASS_DARK} opacity="0.2" />
    <path d={`M32 9V${height - 9}`} stroke={GRASS_MID} strokeWidth={5} opacity="0.45" />
    <path d={`M56 9V${height - 9}`} stroke={GRASS_MID} strokeWidth={5} opacity="0.32" />
    <path d={`M80 9V${height - 9}`} stroke={GRASS_MID} strokeWidth={5} opacity="0.42" />
    <path d={`M104 9V${height - 9}`} stroke={GRASS_MID} strokeWidth={5} opacity="0.28" />
    <path d={`M128 9V${height - 9}`} stroke={GRASS_MID} strokeWidth={5} opacity="0.4" />
  </g>
);

const ShrubCluster = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx="8" cy="40" rx="36" ry="9" fill={LIGHT_SHADOW} />
    <path
      d="M-16 40C-16 21 -3 8 15 8C20 8 25 9 30 12C36 4 46 0 57 0C74 0 88 13 88 30C96 33 102 41 102 51V68H-22V49C-22 45 -20 42 -16 40Z"
      {...strokeProps}
      fill={BRAND_SOFT}
    />
    <path d="M17 34V67" {...strokeProps} />
    <path d="M44 29V67" {...strokeProps} />
    <path d="M71 35V67" {...strokeProps} />
  </g>
);

const Mower = ({
  x,
  y,
  scale = 1,
  rotation = 0
}: {
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
}) => (
  <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
    <ellipse cx="6" cy="27" rx="42" ry="10" fill={SHADOW} />
    <rect x="-24" y="-6" width="66" height="34" rx="17" {...strokeProps} fill={PAPER} />
    <path d="M-6 -18C-6 -31 5 -42 18 -42H31C44 -42 54 -31 54 -18V-6H-6V-18Z" {...strokeProps} fill={SKY} />
    <path d="M-14 -4H34" {...strokeProps} />
    <circle cx="-10" cy="27" r="12" fill={INK} />
    <circle cx="30" cy="27" r="12" fill={INK} />
    <circle cx="-10" cy="27" r="4" fill={PAPER} />
    <circle cx="30" cy="27" r="4" fill={PAPER} />
    <path d="M47 -4H60" {...strokeProps} />
    <circle cx="7" cy="11" r="4.5" fill={BRAND} stroke={INK} strokeWidth="3" />
    <path d="M53 -10C58 -13 62 -18 64 -24" {...strokeProps} />
  </g>
);

const MulchBed = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx="20" cy="38" rx="50" ry="10" fill={LIGHT_SHADOW} />
    <path
      d="M-20 45C-26 18 -6 2 28 2C60 2 84 17 90 38C93 49 87 57 73 59H-4C-13 58 -18 54 -20 45Z"
      fill={MULCH}
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M15 40V11" {...strokeProps} />
    <path d="M15 24C7 22 2 15 2 6" {...strokeProps} />
    <path d="M15 22C25 20 32 13 34 4" {...strokeProps} />
    <path d="M49 39V16" {...strokeProps} />
    <path d="M49 25C41 22 36 16 34 8" {...strokeProps} />
    <path d="M49 24C59 22 66 16 70 8" {...strokeProps} />
  </g>
);

const EdgerGuide = ({
  x,
  y,
  rotation = 0,
  scale = 1
}: {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}) => (
  <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
    <ellipse cx="0" cy="18" rx="14" ry="6" fill={LIGHT_SHADOW} />
    <rect x="-7" y="-22" width="14" height="34" rx="7" {...strokeProps} fill={SKY} />
    <path d="M0 -38V-22" {...strokeProps} />
    <circle cx="0" cy="16" r="12" {...strokeProps} fill={PAPER} />
    <circle cx="0" cy="16" r="4.5" fill={BRAND} stroke={INK} strokeWidth="3" />
  </g>
);

const DebrisBag = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx="10" cy="52" rx="28" ry="9" fill={LIGHT_SHADOW} />
    <path d="M-12 10H34L27 50H-5L-12 10Z" {...strokeProps} fill={PAPER} />
    <path d="M-4 10C-4 2 3 -4 11 -4C20 -4 28 2 28 10" {...strokeProps} fill={BRAND_WASH} />
    <path d="M-3 21H24" {...strokeProps} />
    <path d="M2 32H18" {...strokeProps} />
  </g>
);

const Leaf = ({
  x,
  y,
  rotation = 0,
  scale = 1,
  fill = GOLD
}: {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  fill?: string;
}) => (
  <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
    <path d="M0 -14C11 -10 16 5 0 22C-16 5 -11 -10 0 -14Z" {...strokeProps} fill={fill} />
    <path d="M0 -8V14" {...strokeProps} />
  </g>
);

const ClipCluster = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round">
    <path d="M0 12C5 4 12 -1 20 -3" />
    <path d="M13 14C18 6 25 1 34 -1" />
    <path d="M22 16C28 8 36 3 45 1" />
  </g>
);

const SunIcon = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <circle cx="0" cy="0" r="14" {...strokeProps} fill={GOLD} />
    <path d="M0 -28V-20" {...strokeProps} />
    <path d="M0 20V28" {...strokeProps} />
    <path d="M-28 0H-20" {...strokeProps} />
    <path d="M20 0H28" {...strokeProps} />
    <path d="M20 -20L14 -14" {...strokeProps} />
    <path d="M-20 -20L-14 -14" {...strokeProps} />
    <path d="M20 20L14 14" {...strokeProps} />
    <path d="M-20 20L-14 14" {...strokeProps} />
  </g>
);

const CloudRain = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path
      d="M-24 12C-24 -1 -14 -11 -1 -11C7 -11 14 -8 19 -2C23 -5 29 -7 35 -7C49 -7 60 4 60 18C60 31 49 42 35 42H-6C-20 42 -32 31 -32 17C-32 15 -31 13 -30 11C-28 12 -26 12 -24 12Z"
      {...strokeProps}
      fill={SKY}
    />
    <path d="M-6 49V60" {...strokeProps} />
    <path d="M14 49V64" {...strokeProps} />
    <path d="M34 49V60" {...strokeProps} />
  </g>
);

const AdjustmentDial = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx="0" cy="42" rx="36" ry="9" fill={LIGHT_SHADOW} />
    <circle cx="0" cy="0" r="34" {...strokeProps} fill={PAPER} />
    <path d="M-20 10C-16 -12 2 -24 24 -24" {...strokeProps} />
    <path d="M-20 10L8 -8" stroke={BRAND} strokeWidth="5" strokeLinecap="round" />
    <circle cx="0" cy="0" r="7" fill={BRAND} stroke={INK} strokeWidth="3" />
    <path d="M-20 -10L-26 -17" {...strokeProps} />
    <path d="M0 -22V-32" {...strokeProps} />
    <path d="M24 -8L33 -12" {...strokeProps} />
  </g>
);

const TabletDashboard = ({ x, y, rotation = 0 }: { x: number; y: number; rotation?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${rotation})`}>
    <ellipse cx="10" cy="60" rx="76" ry="12" fill={LIGHT_SHADOW} />
    <rect x="-56" y="-18" width="132" height="88" rx="18" {...strokeProps} fill={PAPER} />
    <rect x="-42" y="-4" width="104" height="58" rx="12" fill="#F0F6EE" stroke={INK} strokeWidth="3" />
    <rect x="-32" y="8" width="42" height="34" rx="8" fill={PAPER} stroke={INK} strokeWidth="3" />
    <path d="M-27 31C-19 20 -9 14 3 13" {...strokeProps} />
    <path d="M-10 26C-3 16 8 10 20 10" fill="none" stroke={BRAND} strokeWidth="4" strokeLinecap="round" />
    <path d="M19 38H48" {...strokeProps} />
    <path d="M19 22H39" {...strokeProps} />
    <rect x="19" y="30" width="12" height="12" rx="4" fill={BRAND_WASH} stroke={INK} strokeWidth="3" />
    <path d="M22 36L26 39L30 33" {...strokeProps} />
    <path d="M-8 70L2 87H38L29 70" {...strokeProps} fill="#E4ECE6" />
  </g>
);

const DocumentTile = ({ x, y, rotation = 0 }: { x: number; y: number; rotation?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${rotation})`}>
    <rect x="-26" y="-22" width="52" height="64" rx="12" {...strokeProps} fill={PAPER} />
    <path d="M-12 -8H12" {...strokeProps} />
    <path d="M-12 6H14" {...strokeProps} />
    <path d="M-12 20H6" {...strokeProps} />
    <rect x="-12" y="28" width="14" height="14" rx="4" fill={BRAND_WASH} stroke={INK} strokeWidth="3" />
    <path d="M-9 35L-5 39L1 31" {...strokeProps} />
  </g>
);

const StatusChip = ({
  x,
  y,
  width = 54,
  fill = BRAND_WASH
}: {
  x: number;
  y: number;
  width?: number;
  fill?: string;
}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={0} y={0} width={width} height={20} rx={10} fill={fill} stroke={INK} strokeWidth="3" />
    <circle cx="16" cy="10" r="5" fill={BRAND} stroke={INK} strokeWidth="3" />
    <path d={`M28 10H${width - 14}`} {...strokeProps} />
  </g>
);

const AutonomousMowingScene = (props: IllustrationSceneProps) => (
  <SceneFrame illustration="autonomousMowing" {...props}>
    <path
      d="M210 64C254 68 286 90 302 129V179H214C219 160 224 126 226 87C227 77 224 69 210 64Z"
      fill={SAND}
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M226 84C249 89 269 101 284 121" fill="none" stroke={SAND_EDGE} strokeWidth="4" strokeLinecap="round" />
    <LawnPatch x={32} y={94} width={146} height={66} rotation={-4} />
    <path
      d="M74 122C92 105 120 100 146 111C162 117 171 128 171 140C171 151 162 160 150 165"
      fill="none"
      stroke={BRAND}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="0.01 10"
    />
    <path d="M145 162C150 161 154 159 158 154" fill="none" stroke={BRAND} strokeWidth="4" strokeLinecap="round" />
    <Mower x={118} y={129} scale={0.9} rotation={-10} />
    <ShrubCluster x={215} y={88} scale={0.72} />
    <ClipCluster x={208} y={146} scale={0.72} />
  </SceneFrame>
);

const SmartEdgingScene = (props: IllustrationSceneProps) => (
  <SceneFrame illustration="smartEdging" {...props}>
    <path
      d="M187 26C232 36 267 64 290 109C306 142 306 169 286 178H156C175 161 184 142 184 121C184 86 174 57 187 26Z"
      fill={SAND}
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M30 119C57 94 92 82 130 83C154 83 170 90 177 103C181 110 182 118 180 126C176 150 165 169 148 178H30V119Z"
      fill={GRASS_LIGHT}
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <MulchBed x={54} y={54} scale={0.72} />
    <path
      d="M154 41C193 48 225 71 247 107C257 123 261 139 258 153C255 166 248 173 235 177"
      fill="none"
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M147 50C184 56 213 79 235 113C244 128 247 142 244 154C242 164 236 170 225 173"
      fill="none"
      stroke={BRAND}
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M108 147C116 144 123 144 130 147" {...strokeProps} />
    <ClipCluster x={124} y={136} scale={0.62} />
    <ClipCluster x={144} y={154} scale={0.5} />
    <EdgerGuide x={255} y={139} rotation={16} scale={0.92} />
  </SceneFrame>
);

const CleanupDebrisScene = (props: IllustrationSceneProps) => (
  <SceneFrame illustration="cleanupDebris" {...props}>
    <path
      d="M24 150C54 130 93 125 130 135C176 147 211 163 254 161C275 160 292 155 304 148V178H24V150Z"
      fill={BRAND_WASH}
    />
    <LawnPatch x={28} y={104} width={138} height={62} rotation={-3} />
    <DebrisBag x={230} y={112} scale={1.02} />
    <path
      d="M102 118C136 111 164 118 188 135C199 143 210 145 224 141"
      fill="none"
      stroke={BRAND}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="0.01 10"
    />
    <path d="M74 145C83 144 92 146 100 152" {...strokeProps} />
    <Leaf x={78} y={127} rotation={-14} scale={0.94} />
    <Leaf x={108} y={143} rotation={9} scale={0.82} fill={GOLD_DEEP} />
    <Leaf x={177} y={131} rotation={18} scale={0.74} />
    <Leaf x={205} y={138} rotation={-10} scale={0.62} fill={GOLD_DEEP} />
    <ClipCluster x={58} y={148} scale={0.66} />
    <ShrubCluster x={214} y={74} scale={0.6} />
  </SceneFrame>
);

const SeasonalMaintenanceScene = (props: IllustrationSceneProps) => (
  <SceneFrame illustration="seasonalMaintenance" {...props}>
    <path
      d="M26 150C63 129 100 124 139 136C184 149 222 164 266 160C282 158 295 153 304 148V178H26V150Z"
      fill={BRAND_WASH}
    />
    <LawnPatch x={40} y={110} width={148} height={56} />
    <SunIcon x={72} y={58} scale={0.82} />
    <CloudRain x={246} y={58} scale={0.72} />
    <AdjustmentDial x={226} y={116} scale={0.94} />
    <path
      d="M96 63C128 61 159 69 184 87C197 96 206 103 211 110"
      fill="none"
      stroke={BRAND}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="0.01 10"
    />
    <path d="M70 146V121" {...strokeProps} />
    <path d="M84 146V115" {...strokeProps} />
    <path d="M98 146V128" {...strokeProps} />
    <path d="M120 145C126 139 130 131 132 122" {...strokeProps} />
    <Leaf x={146} y={145} rotation={22} scale={0.78} fill={GOLD_DEEP} />
    <Leaf x={162} y={136} rotation={-15} scale={0.58} />
  </SceneFrame>
);

const PerformanceReportingScene = (props: IllustrationSceneProps) => (
  <SceneFrame illustration="performanceReporting" {...props}>
    <path
      d="M26 154C67 142 103 143 144 155C184 166 225 171 269 164C284 161 296 157 304 152V178H26V154Z"
      fill={BRAND_WASH}
    />
    <DocumentTile x={74} y={113} rotation={-8} />
    <TabletDashboard x={185} y={96} rotation={3} />
    <StatusChip x={231} y={42} width={58} />
    <StatusChip x={43} y={56} width={52} fill={SKY} />
    <path
      d="M110 60C140 57 167 63 192 80"
      fill="none"
      stroke={BRAND}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="0.01 10"
    />
    <circle cx="106" cy="60" r="5" fill={BRAND} stroke={INK} strokeWidth="3" />
  </SceneFrame>
);

const illustrations: Record<ServiceIllustrationKey, (props: IllustrationSceneProps) => JSX.Element> = {
  autonomousMowing: AutonomousMowingScene,
  smartEdging: SmartEdgingScene,
  cleanupDebris: CleanupDebrisScene,
  seasonalMaintenance: SeasonalMaintenanceScene,
  performanceReporting: PerformanceReportingScene
};

export const ServiceIllustration = ({ illustration, ...props }: ServiceIllustrationProps) => {
  const Illustration = illustrations[illustration];
  return <Illustration {...props} />;
};
