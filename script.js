const DATA_URL = "classrooms.json";
const dayOrder = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const classroomData = {
  classrooms: [],
  unassignedSchedules: []
};

const elements = {
  building: document.getElementById("buildingSelect"),
  floor: document.getElementById("floorSelect"),
  day: document.getElementById("daySelect"),
  start: document.getElementById("startTime"),
  end: document.getElementById("endTime"),
  form: document.getElementById("searchForm"),
  reset: document.getElementById("resetButton"),
  count: document.getElementById("resultCount"),
  status: document.getElementById("statusMessage"),
  results: document.getElementById("resultsList"),
  detailPanel: document.getElementById("detailPanel"),
  detailTitle: document.getElementById("detailTitle"),
  detailContent: document.getElementById("detailContent"),
  closeDetail: document.getElementById("closeDetailButton")
};

function toMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function formatTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function createTimeOptions() {
  for (let minutes = 7 * 60; minutes <= 22 * 60; minutes += 30) {
    const value = formatTime(minutes);
    elements.start.add(new Option(value, value));
    elements.end.add(new Option(value, value));
  }
  elements.start.value = "09:00";
  elements.end.value = "10:00";
}

function loadFloors() {
  const floors = [...new Set(
    classroomData.classrooms
      .filter(room => room.building === elements.building.value)
      .map(room => room.floor)
  )].sort((a, b) => a - b);

  elements.floor.innerHTML = '<option value="">층 선택</option>';

  floors.forEach(floor => {
    elements.floor.add(new Option(`${floor}층`, String(floor)));
  });

  if (floors.length) elements.floor.value = String(floors[0]);
}

function overlaps(searchStart, searchEnd, classStart, classEnd) {
  return searchStart < classEnd && searchEnd > classStart;
}

function getRoomConflicts(room, day, searchStart, searchEnd) {
  return (room.schedules || []).filter(item => {
    if (item.day !== day) return false;

    return overlaps(
      searchStart,
      searchEnd,
      toMinutes(item.start),
      toMinutes(item.end)
    );
  });
}

// 검색 종료 시간 이후 가장 먼저 시작하는 수업 찾기
function getNextSchedule(room, day, searchEnd) {
  return (room.schedules || [])
    .filter(item =>
      item.day === day && toMinutes(item.start) >= searchEnd
    )
    .sort((a, b) =>
      toMinutes(a.start) - toMinutes(b.start)
    )[0] || null;
}

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = `status-message ${type}`.trim();
}

function clearResults() {
  elements.results.innerHTML = "";
  elements.count.textContent = "검색 전";
}

function createInfoRow(label, value, className = "") {
  const row = document.createElement("div");
  row.className = `room-meta-row ${className}`.trim();

  const title = document.createElement("span");
  title.className = "meta-label";
  title.textContent = label;

  const content = document.createElement("span");
  content.className = "meta-value";
  content.textContent = value;

  row.append(title, content);
  return row;
}

function createRoomCard(room, building, floor, day, start, searchEnd) {
  const card = document.createElement("article");
  card.className = "room-card";

  const info = document.createElement("div");
  info.className = "room-info";

  const number = document.createElement("div");
  number.className = "room-number";
  number.textContent = `${room.room}호`;

  const name = document.createElement("div");
  name.className = "room-name";
  name.textContent = room.name || "강의실";

  const location = document.createElement("div");
  location.className = "room-location";
  location.textContent = `${building} ${floor}층`;

  const meta = document.createElement("div");
  meta.className = "room-meta";

  const nextSchedule = getNextSchedule(room, day, searchEnd);

  const availableUntil = nextSchedule
    ? toMinutes(nextSchedule.start)
    : null;

  const availableText = nextSchedule
    ? `${start} ~ ${formatTime(availableUntil)}`
    : `${start} 이후`;

  meta.append(
    createInfoRow("검색 요일", day),
    createInfoRow("이용 가능 시간", availableText, "availability-row")
  );

  const nextInfo = document.createElement("div");
  nextInfo.className = "next-class";

  const nextLabel = document.createElement("span");
  nextLabel.className = "meta-label";
  nextLabel.textContent = "다음 수업";

  const nextValue = document.createElement("span");
  nextValue.className = "meta-value";

  if (nextSchedule) {
    nextValue.textContent =
      `${nextSchedule.start} · ${nextSchedule.subject}`;
  } else {
    nextValue.textContent = "이후 등록된 수업 없음";
  }

  nextInfo.append(nextLabel, nextValue);
  meta.append(nextInfo);

  info.append(number, name, location, meta);

  const actions = document.createElement("div");
  actions.className = "room-actions";

  const tag = document.createElement("span");
  tag.className = "available-tag";
  tag.textContent = "빈 강의실";

  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.className = "detail-button";
  detailButton.textContent = "시간표 보기";
  detailButton.addEventListener("click", () => {
    showRoomSchedule(room);
  });

  actions.append(tag, detailButton);
  card.append(info, actions);

  return card;
}

function searchClassrooms(event) {
  event.preventDefault();

  const building = elements.building.value;
  const floorValue = elements.floor.value;
  const day = elements.day.value;
  const start = elements.start.value;
  const end = elements.end.value;

  if (!floorValue) {
    setStatus("먼저 검색할 층을 선택해 줘.", "warning");
    return;
  }

  const searchStart = toMinutes(start);
  const searchEnd = toMinutes(end);

  if (searchEnd <= searchStart) {
    setStatus("종료 시간은 시작 시간보다 늦어야 해.", "warning");
    return;
  }

  const roomsOnFloor = classroomData.classrooms.filter(room =>
    room.building === building &&
    room.floor === Number(floorValue)
  );

  if (roomsOnFloor.length === 0) {
    clearResults();
    setStatus("해당 층의 강의실 시간표 자료가 등록되어 있지 않아.", "warning");
    return;
  }

  const availableRooms = roomsOnFloor.filter(room =>
    getRoomConflicts(room, day, searchStart, searchEnd).length === 0
  );

  elements.results.innerHTML = "";
  elements.count.textContent = `${availableRooms.length}개`;

  if (availableRooms.length === 0) {
    setStatus(
      `${building} ${floorValue}층에는 ${day} ${start}~${end} 전체 시간 동안 비어 있는 등록 강의실이 없어.`,
      "warning"
    );
    return;
  }

  setStatus(
    `${building} ${floorValue}층 · ${day} ${start}~${end} 검색 결과야. 총 ${availableRooms.length}개 강의실을 찾았어.`,
    "success"
  );

  availableRooms.sort((a, b) =>
    a.room.localeCompare(b.room, "ko", { numeric: true })
  );

  availableRooms.forEach(room => {
    const card = createRoomCard(
      room,
      building,
      floorValue,
      day,
      start,
      searchEnd
    );

    elements.results.append(card);
  });
}

function showRoomSchedule(room) {
  elements.detailTitle.textContent =
    `${room.building} ${room.floor}층 · ${room.room}호 시간표`;

  elements.detailContent.innerHTML = "";

  dayOrder.forEach(day => {
    const dayBlock = document.createElement("div");
    dayBlock.className = "schedule-day";

    const heading = document.createElement("h3");
    heading.textContent = day;
    dayBlock.append(heading);

    const schedules = (room.schedules || [])
      .filter(item => item.day === day)
      .sort((a, b) =>
        toMinutes(a.start) - toMinutes(b.start)
      );

    if (schedules.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-day";
      empty.textContent = "등록된 수업 없음";
      dayBlock.append(empty);
    } else {
      schedules.forEach(item => {
        const row = document.createElement("div");
        row.className = "schedule-item";

        const subject = document.createElement("span");
        subject.textContent = item.subject;

        const time = document.createElement("span");
        time.className = "schedule-time";
        time.textContent = `${item.start}~${item.end}`;

        row.append(subject, time);
        dayBlock.append(row);
      });
    }

    elements.detailContent.append(dayBlock);
  });

  elements.detailPanel.hidden = false;
  elements.detailPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function resetSearch() {
  elements.building.value = "근학관";
  loadFloors();
  elements.day.value = "월요일";
  elements.start.value = "09:00";
  elements.end.value = "10:00";

  clearResults();
  setStatus("건물, 층, 요일과 시간을 선택한 뒤 검색해 줘.");
  elements.detailPanel.hidden = true;
}

async function initialize() {
  createTimeOptions();

  try {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.classrooms) || data.classrooms.length === 0) {
      throw new Error("강의실 데이터 형식이 올바르지 않아.");
    }

    classroomData.classrooms = data.classrooms;
    classroomData.unassignedSchedules = Array.isArray(data.unassignedSchedules)
      ? data.unassignedSchedules
      : [];

    loadFloors();

    setStatus(
      `시간표 데이터를 불러왔어. 등록된 강의실 ${classroomData.classrooms.length}개를 검색할 수 있어.`
    );
  } catch (error) {
    console.error(error);

    setStatus(
      "시간표 파일을 불러오지 못했어. Live Server와 classrooms.json 파일을 확인해 줘.",
      "warning"
    );

    elements.floor.innerHTML =
      '<option value="">데이터를 불러오지 못함</option>';
  }
}

elements.form.addEventListener("submit", searchClassrooms);
elements.reset.addEventListener("click", resetSearch);

elements.closeDetail.addEventListener("click", () => {
  elements.detailPanel.hidden = true;
});

// =========================
// 다크모드 전환 기능
// =========================

const themeToggle = document.getElementById("themeToggle");

// 테마 적용
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  const isDark = theme === "dark";

  themeToggle.textContent = isDark
    ? "☀️ 라이트 모드"
    : "🌙 다크 모드";

  themeToggle.setAttribute("aria-pressed", String(isDark));
}

// 저장된 테마 불러오기
const savedTheme = localStorage.getItem("classroomFinderTheme");

applyTheme(savedTheme === "dark" ? "dark" : "light");

// 버튼 클릭 시 테마 변경
themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme;

  const nextTheme = currentTheme === "dark"
    ? "light"
    : "dark";

  applyTheme(nextTheme);

  // 선택한 테마 저장
  localStorage.setItem("classroomFinderTheme", nextTheme);
});
initialize();