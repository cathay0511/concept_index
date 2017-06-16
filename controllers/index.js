module.exports = {
    'GET /index': async (ctx, next) => {
        ctx.render('index.html', {
            title: 'concept index',
            user: ctx.state.user
        });
    },

    'GET /login': async (ctx, next) => {
        ctx.render('login.html', {
            title: ctx.session.views,
            user: ctx.state.user
        });
    }
};
