import hydratePage from '@reframe/browser/hydratePage';

(async () => {
    await hydratePage();

    // We send the tracking only after the hydration is done
    window.ga=window.ga||function(){(ga.q=ga.q||[]).push(arguments)};ga.l=+new Date;
    ga('create', 'UA-XXXXX-Y', 'auto');
    ga('send', 'pageview');
    console.log('pageview tracking sent');
})();
