module.exports = {
    'GET /index': async (ctx, next) => {
        ctx.render('index.html', {
            title: 'concept index',
            user: ctx.state.user,
            userId: ctx.state.user ? ctx.state.user.id : 0
        });
    },

    'GET /login': async (ctx, next) => {
        ctx.render('login.html', {
            title: ctx.session.views,
            user: ctx.state.user,
            userId: ctx.state.user ? ctx.state.user.id : 0
        });
    }
};
