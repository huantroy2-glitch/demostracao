// Feel constants. Units: metres, seconds, radians.
export const PLAYER = {
  RADIUS: 0.32,
  HEIGHT: 1.8,
  CROUCH_HEIGHT: 1.15,

  WALK_SPEED: 1.75,
  RUN_SPEED: 4.3,
  SPRINT_SPEED: 6.6,
  CROUCH_SPEED: 1.35,
  /** Seconds of continuous running before the run becomes a sprint. */
  SPRINT_DELAY: 1.1,

  GROUND_ACCEL: 9,
  GROUND_DECEL: 11,
  AIR_ACCEL: 2.2,
  TURN_RATE: 10,

  JUMP_VELOCITY: 6.3,
  GRAVITY_UP: 18,
  GRAVITY_DOWN: 27,
  MAX_FALL: 30,
  COYOTE: 0.12,
  JUMP_BUFFER: 0.12,

  /** Highest ledge (curb, step, low wall) climbed automatically while walking. */
  STEP_OFFSET: 0.42,
  /** How far below the feet the ground may drop while still snapping to it. */
  STEP_DOWN: 0.3,

  ROLL_DURATION: 0.85,
  ROLL_SPEED: 5.4,
  ROLL_COOLDOWN: 0.25,

  HARD_LAND_SPEED: 11,
  HARD_LAND_TIME: 0.38,
  LAND_TIME: 0.2,

  SWIM_SPEED: 1.7,
  SWIM_FAST_SPEED: 2.8,
  /** Water deeper than this (surface minus floor) makes the player swim. */
  SWIM_ENTER_DEPTH: 1.15,
  /** Feet depth below the surface while swimming. */
  SWIM_FEET_DEPTH: 1.3,
  /** Highest edge the player can pull up onto from the water. */
  CLIMB_OUT_MAX: 1.75,
  CLIMB_TIME: 0.45,

  INTERACT_RANGE: 1.9,
  ACTION_TIME: 1.0,
} as const;

export const CAMERA = {
  DISTANCE: 4.3,
  MIN_DISTANCE: 2.2,
  MAX_DISTANCE: 7.5,
  PIVOT_HEIGHT: 1.55,
  CROUCH_PIVOT_HEIGHT: 1.05,
  MIN_PITCH: -0.55,
  MAX_PITCH: 1.1,
  MOUSE_SENSITIVITY: 0.0024,
  /** Gap kept between the camera and any wall it would otherwise pass through. */
  COLLISION_PADDING: 0.28,
  FOLLOW_RATE: 14,
  RECOVER_RATE: 4,
} as const;
