async page => {
  // 生成分享图（1200×630）与 iOS 主屏图标（180×180）
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('file:///E:/纸牌魔术/tools/share-card.html');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'assets/og-image.png' });

  // favicon / touch icon：绿底金桃心
  await page.setContent(`<body style="margin:0"><div style="width:180px;height:180px;border-radius:40px;
    background:radial-gradient(ellipse 100% 100% at 50% 40%, #2f8155 0%, #1c5939 60%, #0e3d26 100%);
    display:flex;align-items:center;justify-content:center;">
    <div style="font-size:104px;color:#d2aa62;text-shadow:0 4px 18px rgba(0,0,0,.5);">♠</div>
  </div></body>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'assets/apple-touch-icon.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  return 'assets generated';
}
