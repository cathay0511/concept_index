module.exports = {
    'GET /index': async (ctx, next) => {
        ctx.render('index.html', {
            title: 'concept index'
        });
    },

    'GET /login': async (ctx, next) => {

        let n = ctx.session.views || 0;
        ctx.session.views = ++n;
        // ctx.body = n + ' views';

        ctx.render('login.html', {
            title: ctx.session.views
        });
    }
};
