// src/runtime/primitives.js
/*
 * Akari Programming Language Engine — Runtime Primitives
 * Copyright (c) 2026 [HvK Okla]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
module.exports = {

    // =============================================================
    // Maths
    // =============================================================

    __rt_math_sqrt:      { arity: 1, js: '(x) => Math.sqrt(x)' },
    __rt_math_pow:       { arity: 2, js: '(x, y) => Math.pow(x, y)' },
    __rt_math_abs:       { arity: 1, js: '(x) => Math.abs(x)' },
    __rt_math_floor:     { arity: 1, js: '(x) => Math.floor(x)' },
    __rt_math_ceil:      { arity: 1, js: '(x) => Math.ceil(x)' },
    __rt_math_round:     { arity: 1, js: '(x) => Math.round(x)' },
    __rt_math_sign:      { arity: 1, js: '(x) => Math.sign(x)' },
    __rt_math_min:       { arity: 2, js: '(a, b) => Math.min(a, b)' },
    __rt_math_max:       { arity: 2, js: '(a, b) => Math.max(a, b)' },

    __rt_math_sin:       { arity: 1, js: '(x) => Math.sin(x)' },
    __rt_math_cos:       { arity: 1, js: '(x) => Math.cos(x)' },
    __rt_math_tan:       { arity: 1, js: '(x) => Math.tan(x)' },
    __rt_math_asin:      { arity: 1, js: '(x) => Math.asin(x)' },
    __rt_math_acos:      { arity: 1, js: '(x) => Math.acos(x)' },
    __rt_math_atan:      { arity: 1, js: '(x) => Math.atan(x)' },
    __rt_math_atan2:     { arity: 2, js: '(y, x) => Math.atan2(y, x)' },

    __rt_math_log:       { arity: 1, js: '(x) => Math.log(x)' },
    __rt_math_log2:      { arity: 1, js: '(x) => Math.log2(x)' },
    __rt_math_log10:     { arity: 1, js: '(x) => Math.log10(x)' },
    __rt_math_exp:       { arity: 1, js: '(x) => Math.exp(x)' },
    __rt_math_hypot:     { arity: 2, js: '(a, b) => Math.hypot(a, b)' },

    // --- Random ---
    __rt_math_random:      { arity: 0, js: '() => Math.random()' },
    __rt_math_randomInt:   { arity: 2, js: '(min, max) => Math.floor(Math.random() * (max - min + 1)) + min' },
    __rt_math_randomFloat: { arity: 2, js: '(min, max) => Math.random() * (max - min) + min' },

    // --- Constantes ---
    __rt_math_pi:        { arity: 0, js: '() => Math.PI' },
    __rt_math_tau:       { arity: 0, js: '() => Math.PI * 2' },
    __rt_math_e:         { arity: 0, js: '() => Math.E' },
    __rt_math_inf:       { arity: 0, js: '() => Infinity' },
    __rt_math_nan:       { arity: 0, js: '() => NaN' }

    // =============================================================
    // Ajoutez ici les futures primitives (string, list, table, io, time)
    // =============================================================

};