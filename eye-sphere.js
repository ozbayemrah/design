// ============================================================
// S·PEN Eye Sphere — sphere of '+' symbols shaped like an eye.
// Iris, pupil, and sclera layers; looks around randomly with
// smooth movement. Ported 1:1 from the Rive/Lua procedural draw
// script (fixed-point RNG, state machine, foreshortened iris
// projection) to vanilla Canvas 2D — no Rive runtime required.
// ============================================================

(function () {
  const canvas = document.querySelector(".hero__eye");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- constants (spec) ----
  const RADIUS = 200;
  const GRID_STEP = 3;
  const ARM_MAX = 1.8;
  const ARM_MIN = 0.6;
  const THICK = 0.7;

  const IRIS_R = 0.42;
  const PUPIL_R = 0.18;

  const LOOK_MAX = 0.45;
  const LOOK_SPEED = 7.0;

  const STATE_DRIFT = 0;
  const STATE_SNAP = 1;
  const STATE_HOLD = 2;
  const STATE_BLINK = 3;

  function argb(hex) {
    const a = ((hex >>> 24) & 0xff) / 255;
    const r = (hex >>> 16) & 0xff;
    const g = (hex >>> 8) & 0xff;
    const b = hex & 0xff;
    return `rgba(${r},${g},${b},${a})`;
  }

  const COL_SCLERA_100 = argb(0xffe5e3e6);
  const COL_SCLERA_80 = argb(0xcce5e3e6);
  const COL_SCLERA_60 = argb(0x99e5e3e6);
  const COL_SCLERA_40 = argb(0x66e5e3e6);
  const COL_SCLERA_25 = argb(0x40e5e3e6);
  const COL_IRIS = argb(0xbfe5e3e6);
  const COL_IRIS_INNER = argb(0x80e5e3e6);
  const COL_PUPIL = argb(0x0a000000);
  const COL_DETAIL = argb(0x66e5e3e6);
  const COL_HIGHLIGHT = argb(0xffe5e3e6);

  // Fixed-point LCG RNG, matches the Lua source exactly.
  function rng(s) {
    const r = (((s * 1664525 + 1013904223) % 2147483648) + 2147483648) % 2147483648;
    return r / 2147483648;
  }
  function rngR(s, lo, hi) {
    return lo + rng(s) * (hi - lo);
  }

  const eye = {
    time: 0,
    gazeX: 0,
    gazeY: 0,
    targetX: 0,
    targetY: 0,
    state: STATE_HOLD,
    stateTimer: 0,
    holdTime: 1.5,
    blinkPhase: 0,
    blinkTimer: 0,
    nextBlink: rngR(41, 0.8, 2.5),
  };

  // ---- cursor tracking: once the pointer enters the page, the eye
  // looks toward it instead of wandering; it resumes idle drifting
  // when the pointer leaves the viewport. ----
  let cursorActive = false;
  let originX = 0;
  let originY = 0;
  const cursor = { x: 0, y: 0 };

  function updateOrigin() {
    const rect = canvas.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
  }
  updateOrigin();
  window.addEventListener("resize", updateOrigin, { passive: true });
  window.addEventListener("scroll", updateOrigin, { passive: true });

  if (!reducedMotion) {
    document.addEventListener(
      "mousemove",
      (e) => {
        cursorActive = true;
        cursor.x = e.clientX;
        cursor.y = e.clientY;
      },
      { passive: true }
    );
    document.documentElement.addEventListener("mouseleave", () => {
      cursorActive = false;
    });
    window.addEventListener("blur", () => {
      cursorActive = false;
    });
  }

  function addPlus(segments, x, y, arm) {
    segments.push(x - arm, y, x + arm, y);
    segments.push(x, y - arm, x, y + arm);
  }

  function strokeSegments(segments, color, width) {
    if (!segments.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < segments.length; i += 4) {
      ctx.moveTo(segments[i], segments[i + 1]);
      ctx.lineTo(segments[i + 2], segments[i + 3]);
    }
    ctx.stroke();
  }

  function update(seconds) {
    eye.time += seconds;
    eye.stateTimer += seconds;
    eye.blinkTimer += seconds;
    eye.nextBlink -= seconds;

    const t = eye.time;

    if (cursorActive) {
      const dxRaw = cursor.x - originX;
      const dyRaw = cursor.y - originY;
      const rx = dxRaw < 0 ? originX : window.innerWidth - originX;
      const ry = dyRaw < 0 ? originY : window.innerHeight - originY;
      const nx = Math.max(-1, Math.min(1, rx > 0 ? dxRaw / rx : 0));
      const ny = Math.max(-1, Math.min(1, ry > 0 ? dyRaw / ry : 0));
      eye.targetX = nx * LOOK_MAX;
      eye.targetY = ny * LOOK_MAX;
      eye.gazeX += (eye.targetX - eye.gazeX) * Math.min(1, LOOK_SPEED * seconds);
      eye.gazeY += (eye.targetY - eye.gazeY) * Math.min(1, LOOK_SPEED * seconds);
    } else if (eye.state === STATE_HOLD) {
      if (eye.stateTimer >= eye.holdTime) {
        eye.state = rng(t * 137) > 0.35 ? STATE_SNAP : STATE_DRIFT;
        eye.stateTimer = 0;
        const seed = Math.floor(t * 97);
        eye.targetX = rngR(seed, -LOOK_MAX, LOOK_MAX);
        eye.targetY = rngR(seed * 7, -LOOK_MAX, LOOK_MAX);
      }
    } else if (eye.state === STATE_SNAP) {
      const snapSpeed = LOOK_SPEED * 6;
      const dx = eye.targetX - eye.gazeX;
      const dy = eye.targetY - eye.gazeY;
      eye.gazeX += dx * Math.min(1, snapSpeed * seconds);
      eye.gazeY += dy * Math.min(1, snapSpeed * seconds);
      if (Math.abs(dx) < 0.005 && Math.abs(dy) < 0.005) {
        eye.gazeX = eye.targetX;
        eye.gazeY = eye.targetY;
        eye.state = STATE_HOLD;
        eye.stateTimer = 0;
        eye.holdTime = rngR(Math.floor(t * 53), 0.1, 1.2);
      }
    } else if (eye.state === STATE_DRIFT) {
      const dx = eye.targetX - eye.gazeX;
      const dy = eye.targetY - eye.gazeY;
      eye.gazeX += dx * Math.min(1, LOOK_SPEED * seconds);
      eye.gazeY += dy * Math.min(1, LOOK_SPEED * seconds);
      if (Math.abs(dx) < 0.008 && Math.abs(dy) < 0.008) {
        eye.gazeX = eye.targetX;
        eye.gazeY = eye.targetY;
        eye.state = STATE_HOLD;
        eye.stateTimer = 0;
        eye.holdTime = rngR(Math.floor(t * 71), 0.1, 1.4);
      }
    }

    if (eye.nextBlink <= 0) {
      eye.state = STATE_BLINK;
      eye.blinkTimer = 0;
      eye.nextBlink = rngR(Math.floor(t * 131), 0.8, 2.8);
    }

    if (eye.state === STATE_BLINK) {
      if (eye.blinkTimer < 0.08) {
        eye.blinkPhase = eye.blinkTimer / 0.08;
      } else if (eye.blinkTimer < 0.2) {
        eye.blinkPhase = 1 - (eye.blinkTimer - 0.08) / 0.12;
      } else {
        eye.blinkPhase = 0;
        eye.state = STATE_HOLD;
        eye.stateTimer = 0;
        eye.holdTime = rngR(Math.floor(t * 89), 0.1, 0.9);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);

    const blinkSquish = 1 - eye.blinkPhase * 0.98;

    // Sphere rotation, driven purely by gaze.
    const rotY = eye.gazeX * Math.PI * 0.55;
    const rotX = -eye.gazeY * Math.PI * 0.45;

    const fwdX = Math.sin(rotY);
    const fwdY = -Math.sin(rotX) * Math.cos(rotY);
    const fwdZ = Math.cos(rotX) * Math.cos(rotY);

    const gx = fwdX * RADIUS * 0.96;
    const gy = fwdY * RADIUS * 0.96;

    // ---- sclera: sphere of '+' symbols ----
    const sclera100 = [];
    const sclera80 = [];
    const sclera60 = [];
    const sclera40 = [];
    const sclera25 = [];

    const phiSteps = Math.floor(RADIUS / GRID_STEP);
    const thetaSteps = Math.floor((RADIUS * 2.2) / GRID_STEP);
    const irisR = IRIS_R * RADIUS;

    for (let pi = 0; pi <= phiSteps; pi++) {
      const phi = (pi / phiSteps) * Math.PI;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      for (let ti = 0; ti < thetaSteps; ti++) {
        const theta = (ti / thetaSteps) * Math.PI * 2;
        const sx = sinPhi * Math.cos(theta);
        const sy = sinPhi * Math.sin(theta);
        const sz = cosPhi;

        const rx = sx * Math.cos(rotY) + sz * Math.sin(rotY);
        const rz = -sx * Math.sin(rotY) + sz * Math.cos(rotY);
        const ry = sy;

        const fx = rx;
        const fy = ry * Math.cos(rotX) - rz * Math.sin(rotX);
        const fz = ry * Math.sin(rotX) + rz * Math.cos(rotX);

        if (fz > -0.1) {
          const screenX = fx * RADIUS;
          const screenY = fy * RADIUS;
          const pdx = screenX - gx;
          const pdy = screenY - gy;
          const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

          if (pdist >= irisR * 1.05) {
            const normH = Math.max(0, fz);
            const opacity = 0.25 + 0.75 * normH;
            const arm = (ARM_MIN + (ARM_MAX - ARM_MIN) * normH) * (0.6 + 0.4 * fz);

            if (opacity >= 0.88) addPlus(sclera100, screenX, screenY, arm);
            else if (opacity >= 0.68) addPlus(sclera80, screenX, screenY, arm);
            else if (opacity >= 0.48) addPlus(sclera60, screenX, screenY, arm);
            else if (opacity >= 0.34) addPlus(sclera40, screenX, screenY, arm);
            else addPlus(sclera25, screenX, screenY, arm);
          }
        }
      }
    }

    strokeSegments(sclera25, COL_SCLERA_25, THICK);
    strokeSegments(sclera40, COL_SCLERA_40, THICK);
    strokeSegments(sclera60, COL_SCLERA_60, THICK);
    strokeSegments(sclera80, COL_SCLERA_80, THICK);
    strokeSegments(sclera100, COL_SCLERA_100, THICK);

    // ---- iris / pupil, foreshortened toward sphere centre ----
    const pupilR = PUPIL_R * RADIUS;
    const gDist = Math.sqrt(gx * gx + gy * gy);
    const foreshortenR = Math.max(0.08, fwdZ);

    let axisX = 0;
    let axisY = 0;
    if (gDist > 0.5) {
      axisX = gx / gDist;
      axisY = gy / gDist;
    }
    const tangX = -axisY;
    const tangY = axisX;
    const radialSquish = foreshortenR;
    const tangentSquish = blinkSquish;

    function project(u, v) {
      return [
        tangX * u * tangentSquish + axisX * v * radialSquish,
        tangY * u * tangentSquish + axisY * v * radialSquish,
      ];
    }

    function strokeDashedRing(r, dash, gap, color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash([dash, gap]);
      ctx.beginPath();
      const steps = 64;
      for (let s = 0; s <= steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const p = project(Math.cos(a) * r, Math.sin(a) * r);
        const x = gx + p[0];
        const y = gy + p[1];
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    strokeDashedRing(irisR, 5.0, 4.0, COL_IRIS, 0.6);
    strokeDashedRing(irisR * 0.72, 3.5, 3.0, COL_IRIS_INNER, 0.5);
    strokeDashedRing(irisR * 0.5, 2.5, 2.5, COL_IRIS_INNER, 0.5);

    // Radial spokes.
    const detailSegs = [];
    const spokeCount = 24;
    for (let si = 0; si < spokeCount; si += 2) {
      const a = (si / spokeCount) * Math.PI * 2;
      const cu = Math.cos(a);
      const cv = Math.sin(a);
      const pi2 = project(cu * pupilR * 1.15, cv * pupilR * 1.15);
      const po = project(cu * irisR * 0.88, cv * irisR * 0.88);
      detailSegs.push(gx + pi2[0], gy + pi2[1], gx + po[0], gy + po[1]);
    }
    strokeSegments(detailSegs, COL_DETAIL, 0.5);

    // '+' symbols inside the iris.
    const irisOuterSegs = [];
    const irisInnerSegs = [];
    const irisGridStep = 3;
    const irisSteps = Math.floor((irisR * 2) / irisGridStep);
    for (let ix = 0; ix <= irisSteps; ix++) {
      for (let iy = 0; iy <= irisSteps; iy++) {
        const u = -irisR + ix * irisGridStep;
        const v = -irisR + iy * irisGridStep;
        const distI = Math.sqrt(u * u + v * v);
        if (distI < irisR * 0.9 && distI > pupilR * 1.05) {
          const p = project(u, v);
          const sx = gx + p[0];
          const sy = gy + p[1];
          const edgeFactor = distI / irisR;
          const arm2 = 1.0 + edgeFactor * 1.2;
          if (edgeFactor > 0.55) addPlus(irisOuterSegs, sx, sy, arm2);
          else addPlus(irisInnerSegs, sx, sy, arm2);
        }
      }
    }
    strokeSegments(irisOuterSegs, COL_IRIS, 0.6);
    strokeSegments(irisInnerSegs, COL_IRIS_INNER, 0.5);

    // Pupil (projected filled ellipse).
    ctx.fillStyle = COL_PUPIL;
    ctx.beginPath();
    const pupilSteps = 16;
    for (let s = 0; s < pupilSteps; s++) {
      const a = (s / pupilSteps) * Math.PI * 2;
      const p = project(Math.cos(a) * pupilR, Math.sin(a) * pupilR);
      const x = gx + p[0];
      const y = gy + p[1];
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Specular highlight dots.
    ctx.fillStyle = COL_HIGHLIGHT;
    const h1 = project(-pupilR * 0.38, -pupilR * 0.42);
    ctx.beginPath();
    ctx.arc(gx + h1[0], gy + h1[1], pupilR * 0.22, 0, Math.PI * 2);
    ctx.fill();
    const h2 = project(pupilR * 0.28, pupilR * 0.35);
    ctx.beginPath();
    ctx.arc(gx + h2[0], gy + h2[1], pupilR * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  if (reducedMotion) {
    update(0);
    draw();
    return;
  }

  let last = performance.now();
  function frame(now) {
    const seconds = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(seconds);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
