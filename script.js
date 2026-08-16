const barsContainer = document.getElementById("barsContainer");
const sizeSlider = document.getElementById("size");
const sizeValue = document.getElementById("sizeValue");
const speedSlider = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");
const randomizeBtn = document.getElementById("randomizeBtn");
const sortBtn = document.getElementById("sortBtn");
const algoSelect = document.getElementById("algoSelect");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");

const allButtons = [randomizeBtn, sortBtn];

let array = [];
let isSorting = false;
let stopRequested = false;

const speedLabels = { 1: "Very Slow", 2: "Slow", 3: "Normal", 4: "Fast", 5: "Very Fast" };
const speedDelays = { 1: 200, 2: 90, 3: 40, 4: 15, 5: 4 };

function currentDelay() {
  return speedDelays[speedSlider.value];
}

function randomArray(size) {
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(Math.floor(Math.random() * 380) + 10);
  }
  return arr;
}

function renderBars() {
  barsContainer.innerHTML = "";
  const containerWidth = barsContainer.clientWidth - 24;
  const gap = 2;
  const barWidth = Math.max((containerWidth - gap * (array.length - 1)) / array.length, 2);

  array.forEach((value) => {
    const bar = document.createElement("div");
    bar.classList.add("bar");
    bar.style.height = `${value}px`;
    bar.style.width = `${barWidth}px`;
    barsContainer.appendChild(bar);
  });
}

function getBars() {
  return barsContainer.querySelectorAll(".bar");
}

function clearHighlights() {
  const bars = getBars();
  bars.forEach((bar) => {
    bar.classList.remove("comparing", "swapping");
  });
}

function markSorted(index) {
  const bars = getBars();
  if (bars[index]) bars[index].classList.add("sorted");
}

function markAllSorted() {
  const bars = getBars();
  bars.forEach((bar) => bar.classList.add("sorted"));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setControlsDisabled(disabled) {
  allButtons.forEach((btn) => (btn.disabled = disabled));
  sizeSlider.disabled = disabled;
  algoSelect.disabled = disabled;
  stopBtn.disabled = !disabled;
}

function initArray() {
  const size = Number(sizeSlider.value);
  array = randomArray(size);
  renderBars();
  statusEl.textContent = "Array randomized. Choose a sorting algorithm.";
}

sizeSlider.addEventListener("input", () => {
  sizeValue.textContent = sizeSlider.value;
  if (!isSorting) initArray();
});

speedSlider.addEventListener("input", () => {
  speedValue.textContent = speedLabels[speedSlider.value];
});

randomizeBtn.addEventListener("click", () => {
  if (isSorting) return;
  initArray();
});

stopBtn.addEventListener("click", () => {
  stopRequested = true;
});

window.addEventListener("resize", () => {
  if (!isSorting) renderBars();
});

// ---- Sorting generators ----
// Each generator yields step objects describing what to animate.
// { type: "compare", indices: [i, j] }
// { type: "swap", indices: [i, j], values: [newI, newJ] }
// { type: "overwrite", index: i, value: v }  (used for shifting in binary insertion sort)
// { type: "sorted", index: i }

function* bubbleSortGenerator(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - i - 1; j++) {
      yield { type: "compare", indices: [j, j + 1] };
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        yield { type: "swap", indices: [j, j + 1], values: [arr[j], arr[j + 1]] };
        swapped = true;
      }
    }
    yield { type: "sorted", index: n - i - 1 };
    if (!swapped) break;
  }
  for (let i = 0; i < n; i++) yield { type: "sorted", index: i };
}

// "Exchange sort": compare each element with every later element, swap if out of order.
function* exchangeSortGenerator(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      yield { type: "compare", indices: [i, j] };
      if (arr[i] > arr[j]) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
        yield { type: "swap", indices: [i, j], values: [arr[i], arr[j]] };
      }
    }
    yield { type: "sorted", index: i };
  }
  yield { type: "sorted", index: n - 1 };
}

// Binary insertion sort: use binary search to find insertion point, then shift.
function* binaryInsertionSortGenerator(arr) {
  const n = arr.length;
  for (let i = 1; i < n; i++) {
    const key = arr[i];
    let lo = 0;
    let hi = i;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      yield { type: "compare", indices: [mid, i] };
      if (arr[mid] > key) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    for (let j = i; j > lo; j--) {
      arr[j] = arr[j - 1];
      yield { type: "overwrite", index: j, value: arr[j] };
    }
    arr[lo] = key;
    yield { type: "overwrite", index: lo, value: key };
  }
  for (let i = 0; i < n; i++) yield { type: "sorted", index: i };
}

function* selectionSortGenerator(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      yield { type: "compare", indices: [minIdx, j] };
      if (arr[j] < arr[minIdx]) minIdx = j;
    }
    if (minIdx !== i) {
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
      yield { type: "swap", indices: [i, minIdx], values: [arr[i], arr[minIdx]] };
    }
    yield { type: "sorted", index: i };
  }
  yield { type: "sorted", index: n - 1 };
}

function* insertionSortGenerator(arr) {
  const n = arr.length;
  for (let i = 1; i < n; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= 0) {
      yield { type: "compare", indices: [j, j + 1] };
      if (arr[j] > key) {
        arr[j + 1] = arr[j];
        yield { type: "overwrite", index: j + 1, value: arr[j + 1] };
        j--;
      } else {
        break;
      }
    }
    arr[j + 1] = key;
    yield { type: "overwrite", index: j + 1, value: key };
  }
  for (let i = 0; i < n; i++) yield { type: "sorted", index: i };
}

function* mergeGenerator(arr, lo, mid, hi) {
  const left = arr.slice(lo, mid + 1);
  const right = arr.slice(mid + 1, hi + 1);
  let i = 0;
  let j = 0;
  let k = lo;
  while (i < left.length && j < right.length) {
    yield { type: "compare", indices: [lo + i, mid + 1 + j] };
    if (left[i] <= right[j]) {
      arr[k] = left[i];
      i++;
    } else {
      arr[k] = right[j];
      j++;
    }
    yield { type: "overwrite", index: k, value: arr[k] };
    k++;
  }
  while (i < left.length) {
    arr[k] = left[i];
    yield { type: "overwrite", index: k, value: arr[k] };
    i++;
    k++;
  }
  while (j < right.length) {
    arr[k] = right[j];
    yield { type: "overwrite", index: k, value: arr[k] };
    j++;
    k++;
  }
}

function* mergeSortRange(arr, lo, hi) {
  if (lo >= hi) return;
  const mid = Math.floor((lo + hi) / 2);
  yield* mergeSortRange(arr, lo, mid);
  yield* mergeSortRange(arr, mid + 1, hi);
  yield* mergeGenerator(arr, lo, mid, hi);
}

function* mergeSortGenerator(arr) {
  yield* mergeSortRange(arr, 0, arr.length - 1);
  for (let i = 0; i < arr.length; i++) yield { type: "sorted", index: i };
}

function* partitionGenerator(arr, lo, hi) {
  const pivot = arr[hi];
  let i = lo - 1;
  for (let j = lo; j < hi; j++) {
    yield { type: "compare", indices: [j, hi] };
    if (arr[j] < pivot) {
      i++;
      if (i !== j) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
        yield { type: "swap", indices: [i, j], values: [arr[i], arr[j]] };
      }
    }
  }
  if (i + 1 !== hi) {
    [arr[i + 1], arr[hi]] = [arr[hi], arr[i + 1]];
    yield { type: "swap", indices: [i + 1, hi], values: [arr[i + 1], arr[hi]] };
  }
  return i + 1;
}

function* quickSortRange(arr, lo, hi) {
  if (lo < hi) {
    const p = yield* partitionGenerator(arr, lo, hi);
    yield { type: "sorted", index: p };
    yield* quickSortRange(arr, lo, p - 1);
    yield* quickSortRange(arr, p + 1, hi);
  }
}

function* quickSortGenerator(arr) {
  yield* quickSortRange(arr, 0, arr.length - 1);
  for (let i = 0; i < arr.length; i++) yield { type: "sorted", index: i };
}

function* siftDownGenerator(arr, n, i) {
  while (true) {
    let largest = i;
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l < n) {
      yield { type: "compare", indices: [l, largest] };
      if (arr[l] > arr[largest]) largest = l;
    }
    if (r < n) {
      yield { type: "compare", indices: [r, largest] };
      if (arr[r] > arr[largest]) largest = r;
    }
    if (largest === i) break;
    [arr[i], arr[largest]] = [arr[largest], arr[i]];
    yield { type: "swap", indices: [i, largest], values: [arr[i], arr[largest]] };
    i = largest;
  }
}

function* heapSortGenerator(arr) {
  const n = arr.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    yield* siftDownGenerator(arr, n, i);
  }
  for (let i = n - 1; i > 0; i--) {
    [arr[0], arr[i]] = [arr[i], arr[0]];
    yield { type: "swap", indices: [0, i], values: [arr[0], arr[i]] };
    yield { type: "sorted", index: i };
    yield* siftDownGenerator(arr, i, 0);
  }
  yield { type: "sorted", index: 0 };
}

const sourceCode = {
  bubble: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        swapped = False
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr`,
  exchange: `def exchange_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        for j in range(i + 1, n):
            if arr[i] > arr[j]:
                arr[i], arr[j] = arr[j], arr[i]
    return arr`,
  binary: `def binary_insertion_sort(arr):
    n = len(arr)
    for i in range(1, n):
        key = arr[i]
        lo, hi = 0, i
        while lo < hi:
            mid = (lo + hi) // 2
            if arr[mid] > key:
                hi = mid
            else:
                lo = mid + 1
        for j in range(i, lo, -1):
            arr[j] = arr[j - 1]
        arr[lo] = key
    return arr`,
  selection: `def selection_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        min_idx = i
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j
        if min_idx != i:
            arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr`,
  insertion: `def insertion_sort(arr):
    n = len(arr)
    for i in range(1, n):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr`,
  merge: `def merge_sort(arr, lo=0, hi=None):
    if hi is None:
        hi = len(arr) - 1
    if lo >= hi:
        return arr
    mid = (lo + hi) // 2
    merge_sort(arr, lo, mid)
    merge_sort(arr, mid + 1, hi)
    merge(arr, lo, mid, hi)
    return arr


def merge(arr, lo, mid, hi):
    left = arr[lo:mid + 1]
    right = arr[mid + 1:hi + 1]
    i = j = 0
    k = lo
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            arr[k] = left[i]
            i += 1
        else:
            arr[k] = right[j]
            j += 1
        k += 1
    while i < len(left):
        arr[k] = left[i]
        i += 1
        k += 1
    while j < len(right):
        arr[k] = right[j]
        j += 1
        k += 1`,
  quick: `def quick_sort(arr, lo=0, hi=None):
    if hi is None:
        hi = len(arr) - 1
    if lo < hi:
        p = partition(arr, lo, hi)
        quick_sort(arr, lo, p - 1)
        quick_sort(arr, p + 1, hi)
    return arr


def partition(arr, lo, hi):
    pivot = arr[hi]
    i = lo - 1
    for j in range(lo, hi):
        if arr[j] < pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[hi] = arr[hi], arr[i + 1]
    return i + 1`,
  heap: `def heap_sort(arr):
    n = len(arr)
    for i in range(n // 2 - 1, -1, -1):
        sift_down(arr, n, i)
    for i in range(n - 1, 0, -1):
        arr[0], arr[i] = arr[i], arr[0]
        sift_down(arr, i, 0)
    return arr


def sift_down(arr, n, i):
    largest = i
    l, r = 2 * i + 1, 2 * i + 2
    if l < n and arr[l] > arr[largest]:
        largest = l
    if r < n and arr[r] > arr[largest]:
        largest = r
    if largest == i:
        return
    arr[i], arr[largest] = arr[largest], arr[i]
    sift_down(arr, n, largest)`,
};

const algorithms = {
  bubble: { label: "Bubble Sort", generator: bubbleSortGenerator, row: "row-bubble" },
  exchange: { label: "Exchange Sort", generator: exchangeSortGenerator, row: "row-exchange" },
  binary: { label: "Binary Insertion Sort", generator: binaryInsertionSortGenerator, row: "row-binary" },
  selection: { label: "Selection Sort", generator: selectionSortGenerator, row: "row-selection" },
  insertion: { label: "Insertion Sort", generator: insertionSortGenerator, row: "row-insertion" },
  merge: { label: "Merge Sort", generator: mergeSortGenerator, row: "row-merge" },
  quick: { label: "Quick Sort", generator: quickSortGenerator, row: "row-quick" },
  heap: { label: "Heap Sort", generator: heapSortGenerator, row: "row-heap" },
};

const codeTitleEl = document.getElementById("codeTitle");
const codeDisplayEl = document.getElementById("codeDisplay");

function setCodeDisplay(key) {
  codeTitleEl.textContent = `${algorithms[key].label} — Source`;
  codeDisplayEl.textContent = sourceCode[key];
}

// ---- Complexity table highlighting ----
function setActiveRow(key) {
  Object.values(algorithms).forEach((algo) => {
    const row = document.getElementById(algo.row);
    if (row) row.classList.remove("active");
  });
  const row = document.getElementById(algorithms[key].row);
  if (row) row.classList.add("active");
}

// ---- Animation driver ----
async function runSort(generatorFn, label) {
  if (isSorting) return;
  isSorting = true;
  stopRequested = false;
  setControlsDisabled(true);
  statusEl.textContent = `Running ${label}...`;

  const arr = array.slice();
  const gen = generatorFn(arr);

  for (const step of gen) {
    if (stopRequested) {
      statusEl.textContent = "Sorting stopped.";
      break;
    }

    clearHighlights();
    const bars = getBars();

    if (step.type === "compare") {
      const [a, b] = step.indices;
      if (bars[a]) bars[a].classList.add("comparing");
      if (bars[b]) bars[b].classList.add("comparing");
    } else if (step.type === "swap") {
      const [a, b] = step.indices;
      const [va, vb] = step.values;
      if (bars[a]) {
        bars[a].classList.add("swapping");
        bars[a].style.height = `${va}px`;
      }
      if (bars[b]) {
        bars[b].classList.add("swapping");
        bars[b].style.height = `${vb}px`;
      }
    } else if (step.type === "overwrite") {
      if (bars[step.index]) {
        bars[step.index].classList.add("swapping");
        bars[step.index].style.height = `${step.value}px`;
      }
    } else if (step.type === "sorted") {
      markSorted(step.index);
    }

    await sleep(currentDelay());
  }

  if (!stopRequested) {
    markAllSorted();
    statusEl.textContent = `${label} complete!`;
  }

  array = arr;
  isSorting = false;
  setControlsDisabled(false);
}

sortBtn.addEventListener("click", () => {
  const key = algoSelect.value;
  const algo = algorithms[key];
  setActiveRow(key);
  runSort(algo.generator, algo.label);
});

algoSelect.addEventListener("change", () => {
  if (isSorting) return;
  setActiveRow(algoSelect.value);
  setCodeDisplay(algoSelect.value);
});

// ---- Init ----
speedValue.textContent = speedLabels[speedSlider.value];
setActiveRow(algoSelect.value);
setCodeDisplay(algoSelect.value);
initArray();
