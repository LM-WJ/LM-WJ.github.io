var OriginTitle = document.title;
var titleTime;
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        document.title = 'ヾ(❀╹◡╹)ﾉ~我藏好了哦';
        clearTimeout(titleTime);
    }
    else {
        document.title = '（*＾ワ＾*）被你发现啦' + OriginTitle;
        titleTime = setTimeout(function () {
            document.title = OriginTitle;
        }, 2000);
    }
});