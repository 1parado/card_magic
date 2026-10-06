async page => {
  // 重新生成分享图（1200×630）——文件协议直接读本地模板
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('file:///E:/纸牌魔术/tools/share-card.html');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'assets/og-image.png' });
  return 'og-image regenerated';
}
