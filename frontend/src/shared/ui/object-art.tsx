import { useId } from 'react'

import { cn } from '@/shared/lib/utils'

type ObjectArtProps = {
  category: string
  color?: string
  type?: string
  className?: string
  scene?: boolean
}

export function ObjectArt({
  category,
  color = '#c4b39b',
  type,
  className,
  scene = false,
}: ObjectArtProps) {
  const identifier = useId().replaceAll(':', '')
  const gradient = `${identifier}-object`
  const shadow = `${identifier}-shadow`
  const texture = `${identifier}-texture`
  const isVase = category === 'decor' || type === 'vase' || type === 'jug'
  const isPlate = type === 'plate' || type === 'bowl'
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        !scene && 'product-art',
        className,
      )}
    >
      <svg
        viewBox="0 0 400 450"
        fill="none"
        aria-hidden="true"
        className="h-full w-full"
      >
        <defs>
          <linearGradient
            id={gradient}
            x1="100"
            y1="200"
            x2="295"
            y2="240"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={color} />
            <stop offset="0.35" stopColor={color} />
            <stop offset="0.6" stopColor={color} />
            <stop offset="1" stopColor={color} />
          </linearGradient>
          <linearGradient
            id={`${gradient}-light`}
            x1="105"
            y1="180"
            x2="285"
            y2="230"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" stopOpacity="0.22" />
            <stop offset="0.5" stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="#29271f" stopOpacity="0.2" />
          </linearGradient>
          <filter id={shadow}>
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id={texture} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.7"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.035" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" mode="multiply" />
          </filter>
        </defs>
        {!scene && <path d="M0 365H400V450H0Z" fill="#e8e3da" opacity="0.4" />}
        <ellipse
          cx="217"
          cy="362"
          rx="90"
          ry="14"
          fill="#77715e"
          opacity="0.2"
          filter={`url(#${shadow})`}
        />
        <g filter={`url(#${texture})`}>
          {category === 'candles' && (
            <>
              <path
                d="M125 200Q125 180 200 180Q275 180 275 200V328Q274 355 200 355Q126 355 125 328Z"
                fill={`url(#${gradient})`}
              />
              <path
                d="M125 200Q125 180 200 180Q275 180 275 200V328Q274 355 200 355Q126 355 125 328Z"
                fill={`url(#${gradient}-light)`}
              />
              <ellipse cx="200" cy="199" rx="70" ry="18" fill="#e6ded0" />
              <ellipse cx="200" cy="198" rx="64" ry="14" fill="#f4eeda" />
              <path d="M201 197V178" stroke="#625648" strokeWidth="2.5" />
              <path
                d="M202 145Q184 166 200 177Q214 166 202 145Z"
                fill="#d69b52"
                opacity="0.8"
              />
              <path
                d="M201 161Q193 172 201 175Q208 170 201 161Z"
                fill="#fff4bb"
              />
              <rect
                x="159"
                y="244"
                width="82"
                height="66"
                rx="1"
                fill="#f5f1e8"
                opacity="0.94"
              />
              <text
                x="200"
                y="269"
                textAnchor="middle"
                fill="#625e50"
                fontSize="12"
                fontFamily="Georgia"
                letterSpacing="4"
              >
                tiho
              </text>
              <path
                d="M182 282H218M188 290H212"
                stroke="#b0a899"
                strokeWidth="1"
              />
            </>
          )}
          {category === 'diffusers' && (
            <>
              <path
                d="M180 196L156 80M195 195L200 63M208 196L236 72M221 202L267 110M177 203L133 122"
                stroke="#807156"
                strokeWidth="3.2"
              />
              <path
                d="M169 192H231V213Q258 228 262 257V326Q262 356 200 357Q138 356 138 326V257Q142 228 169 213Z"
                fill={`url(#${gradient})`}
              />
              <path
                d="M169 192H231V213Q258 228 262 257V326Q262 356 200 357Q138 356 138 326V257Q142 228 169 213Z"
                fill={`url(#${gradient}-light)`}
              />
              <ellipse cx="200" cy="193" rx="31" ry="7" fill="#746c59" />
              <path
                d="M159 253V321"
                stroke="white"
                opacity="0.22"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <rect x="172" y="260" width="60" height="59" fill="#f2eadc" />
              <text
                x="202"
                y="291"
                textAnchor="middle"
                fill="#645b4c"
                fontSize="12"
                fontFamily="Georgia"
                letterSpacing="3"
              >
                tiho
              </text>
            </>
          )}
          {category === 'ceramics' && !isVase && !isPlate && (
            <>
              <path
                d="M264 229C322 209 319 311 266 302"
                stroke={color}
                strokeWidth="22"
              />
              <path
                d="M268 230C305 228 306 289 273 292"
                stroke="#29271f"
                strokeOpacity="0.13"
                strokeWidth="5"
              />
              <path
                d="M119 217H272L265 321Q263 351 196 353Q131 351 127 321Z"
                fill={`url(#${gradient})`}
              />
              <path
                d="M119 217H272L265 321Q263 351 196 353Q131 351 127 321Z"
                fill={`url(#${gradient}-light)`}
              />
              <ellipse cx="195" cy="217" rx="77" ry="22" fill={color} />
              <ellipse
                cx="195"
                cy="217"
                rx="65"
                ry="16"
                fill="#615947"
                opacity="0.2"
              />
              <path
                d="M137 218Q193 195 254 219"
                stroke="#6f6454"
                strokeOpacity="0.2"
                strokeWidth="3"
              />
            </>
          )}
          {category === 'ceramics' && isPlate && (
            <>
              <ellipse cx="200" cy="278" rx="129" ry="81" fill={color} />
              <ellipse
                cx="200"
                cy="278"
                rx="129"
                ry="81"
                fill={`url(#${gradient}-light)`}
              />
              <ellipse
                cx="200"
                cy="272"
                rx="95"
                ry="57"
                stroke="#4d4536"
                strokeOpacity="0.12"
                strokeWidth="3"
              />
              <ellipse
                cx="200"
                cy="274"
                rx="89"
                ry="53"
                fill="#fff"
                opacity="0.09"
              />
            </>
          )}
          {isVase && (
            <>
              <path
                d="M185 210C160 141 214 95 225 67M192 150C149 132 148 106 142 86M197 119C222 123 251 103 264 89"
                stroke="#777d60"
                strokeWidth="2"
              />
              <path
                d="M180 142C148 142 133 130 137 112C160 111 180 126 180 142ZM215 100C223 72 240 66 250 67C249 85 235 99 215 100ZM193 169C209 144 230 143 240 149C227 168 213 172 193 169Z"
                fill="#8d957c"
              />
              <path
                d="M164 195H236L231 230C285 254 302 298 279 332C263 359 137 359 121 332C98 298 115 254 169 230Z"
                fill={`url(#${gradient})`}
              />
              <path
                d="M164 195H236L231 230C285 254 302 298 279 332C263 359 137 359 121 332C98 298 115 254 169 230Z"
                fill={`url(#${gradient}-light)`}
              />
              <ellipse cx="200" cy="195" rx="36" ry="9" fill={color} />
              <ellipse
                cx="200"
                cy="195"
                rx="29"
                ry="5"
                fill="#655742"
                opacity="0.3"
              />
            </>
          )}
          {category === 'textiles' && (
            <>
              <path
                d="M87 252L220 189L326 254L305 342L172 383L71 319Z"
                fill={color}
              />
              <path
                d="M87 252L220 189L326 254L305 342L172 383L71 319Z"
                fill={`url(#${gradient}-light)`}
              />
              <path
                d="M87 252L176 306L326 254M176 306L172 383M74 314L172 373L307 333M78 302L174 360L311 321"
                stroke="#eee9dc"
                strokeOpacity="0.5"
                strokeWidth="3"
              />
              {Array.from({ length: 18 }, (_, index) => (
                <path
                  key={`thread-${index}`}
                  d={`M${173 + index * 7} ${373 - index * 2.1}l-1 15`}
                  stroke={color}
                  strokeWidth="4"
                />
              ))}
            </>
          )}
          {category === 'kitchen' && (
            <>
              <path
                d="M99 253L262 196Q278 191 291 204L322 235Q329 245 313 253L163 338Q149 346 136 336L84 291Q72 279 99 253Z"
                fill={color}
              />
              <path
                d="M99 253L262 196Q278 191 291 204L322 235Q329 245 313 253L163 338Q149 346 136 336L84 291Q72 279 99 253Z"
                fill={`url(#${gradient}-light)`}
              />
              <path
                d="M108 275L273 217M119 288L286 229M132 302L294 245M145 315L280 263"
                stroke="#665439"
                strokeOpacity="0.17"
                strokeWidth="2"
              />
              <ellipse cx="194" cy="234" rx="45" ry="26" fill="#ddd6c3" />
              <ellipse cx="194" cy="231" rx="37" ry="20" fill="#f3eee2" />
              <path
                d="M242 289C240 244 264 210 295 186M257 244C236 238 233 224 236 213M271 218C287 220 300 214 308 203"
                stroke="#6a775a"
                strokeWidth="2"
              />
              <ellipse
                cx="259"
                cy="239"
                rx="8"
                ry="17"
                transform="rotate(-45 259 239)"
                fill="#8c957a"
              />
              <ellipse
                cx="287"
                cy="210"
                rx="8"
                ry="16"
                transform="rotate(55 287 210)"
                fill="#8c957a"
              />
            </>
          )}
        </g>
      </svg>
    </div>
  )
}
