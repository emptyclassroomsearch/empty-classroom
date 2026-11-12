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

// =========================
// 시간 관련 기능
// =========================

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

// =========================
// 건물 및 층 선택
// =========================

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

  if (floors.length) {
    elements.floor.value = String(floors[0]);
  }
}

// =========================
// 수업 시간 겹침 확인
// =========================

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

function getNextSchedule(room, day, searchEnd) {
  return (room.schedules || [])
    .filter(item =>
      item.day === day && toMinutes(item.start) >= searchEnd
    )
    .sort((a, b) =>
      toMinutes(a.start) - toMinutes(b.start)
    )[0] || null;
}

// =========================
// 검색 결과 상태
// =========================

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

// =========================
// 강의실 카드 생성
// =========================

function createRoomCard(room, building, floor, day, start, searchEnd) {
  const card = document.createElement("article");
  card.className = "room-card";

  // 카드 상단
  const header = document.createElement("div");
  header.className = "room-card-header";

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

  info.append(number, name, location);

  const badge = document.createElement("span");
  badge.className = "room-card-badge";
  badge.innerHTML = '<span class="room-card-badge-dot"></span> 이용 가능';

  header.append(info, badge);

  // 검색 정보
  const meta = document.createElement("div");
  meta.className = "room-meta";

  const nextSchedule = getNextSchedule(room, day, searchEnd);

  const availableText = nextSchedule
    ? `${start} ~ ${nextSchedule.start}`
    : `${start} 이후`;

  meta.append(
    createInfoRow("검색 요일", day),
    createInfoRow("이용 가능 시간", availableText, "availability-row")
  );

  // 다음 수업 정보
  const nextInfo = document.createElement("div");
  nextInfo.className = "next-class";

  const nextLabel = document.createElement("span");
  nextLabel.className = "next-class-label";
  nextLabel.textContent = "NEXT CLASS";

  const nextValue = document.createElement("span");
  nextValue.className = "next-class-value";

  if (nextSchedule) {
    nextValue.textContent =
      `${nextSchedule.start} · ${nextSchedule.subject}`;
  } else {
    nextValue.textContent = "이후 등록된 수업 없음";
  }

  nextInfo.append(nextLabel, nextValue);
  meta.append(nextInfo);

  // 카드 하단
  const footer = document.createElement("div");
  footer.className = "room-card-footer";

  const tag = document.createElement("span");
  tag.className = "available-tag";
  tag.textContent = "✓ 빈 강의실";

  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.className = "detail-button";
  detailButton.textContent = "상세 시간표 보기 →";

  detailButton.addEventListener("click", () => {
    showRoomSchedule(room);
  });

  footer.append(tag, detailButton);

  card.append(header, meta, footer);

  return card;
}

// =========================
// 강의실 검색
// =========================

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

    setStatus(
      "해당 층의 강의실 시간표 자료가 등록되어 있지 않아.",
      "warning"
    );

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

// =========================
// 강의실 상세 시간표
// =========================

function showRoomSchedule(room) {
  elements.detailTitle.textContent =
    `${room.building} ${room.floor}층 · ${room.room}호 시간표`;

  elements.detailContent.innerHTML = "";

  dayOrder.forEach(day => {
    const dayBlock = document.createElement("div");
    dayBlock.className = "schedule-day";

    const schedules = (room.schedules || [])
      .filter(item => item.day === day)
      .sort((a, b) =>
        toMinutes(a.start) - toMinutes(b.start)
      );

    dayBlock.classList.add(
      schedules.length ? "has-schedules" : "is-empty"
    );

    const heading = document.createElement("h3");
    heading.className = "schedule-heading";

    const dayName = document.createElement("span");
    dayName.textContent = day;

    const dayCount = document.createElement("span");
    dayCount.className = "schedule-count";
    dayCount.textContent = schedules.length
      ? `${schedules.length}개 수업`
      : "수업 없음";

    heading.append(dayName, dayCount);
    dayBlock.append(heading);

    if (schedules.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-day";
      empty.textContent = "등록된 수업이 없어. 자유롭게 이용할 수 있어.";

      dayBlock.append(empty);
    } else {
      schedules.forEach(item => {
        const row = document.createElement("div");
        row.className = "schedule-item";

        const subject = document.createElement("span");
        subject.className = "schedule-subject";
        subject.textContent = item.subject;

        const time = document.createElement("span");
        time.className = "schedule-time";
        time.textContent = `${item.start} ~ ${item.end}`;

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

// =========================
// 검색 초기화
// =========================

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

// =========================
// 다크 모드
// =========================

const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.body.classList.toggle("dark-mode", isDark);

  themeToggle.textContent = isDark
    ? "☀️ 라이트 모드"
    : "🌙 다크 모드";

  themeToggle.setAttribute("aria-pressed", String(isDark));
}

const savedTheme =
  localStorage.getItem("classroomFinderTheme") || "light";

applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark-mode");
  const nextTheme = isDark ? "light" : "dark";

  localStorage.setItem("classroomFinderTheme", nextTheme);

  applyTheme(nextTheme);
});

// =========================
// 데이터 불러오기
// =========================

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

    classroomData.unassignedSchedules =
      Array.isArray(data.unassignedSchedules)
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

// =========================
// 이벤트 연결
// =========================

elements.form.addEventListener("submit", searchClassrooms);

elements.reset.addEventListener("click", resetSearch);

elements.closeDetail.addEventListener("click", () => {
  elements.detailPanel.hidden = true;
});

// 프로그램 시작
initialize();
