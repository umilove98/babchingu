// 밥친구 푸시 알림 서비스워커
// 페이로드 형식: { title, body, url, tag }

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "밥친구", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "밥친구";
  const body = data.body || "";
  const url = data.url || "/";
  const tag = data.tag || url;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/img/dosirak.png",
      badge: "/img/dosirak.png",
      data: { url },
      tag,
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const origin = self.location.origin;
      // 1) 이미 같은 경로가 열려있으면 focus
      for (const c of all) {
        try {
          const u = new URL(c.url);
          if (u.origin === origin && u.pathname === targetUrl) {
            await c.focus();
            return;
          }
        } catch {}
      }
      // 2) 앱 탭이 있으면 focus 후 navigate
      for (const c of all) {
        try {
          const u = new URL(c.url);
          if (u.origin === origin) {
            await c.focus();
            if ("navigate" in c) {
              try {
                await c.navigate(targetUrl);
                return;
              } catch {}
            }
            return;
          }
        } catch {}
      }
      // 3) 새 창
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
