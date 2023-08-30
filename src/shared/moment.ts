export const formatDateTime = (time: string) => {
	return window.moment(time).format("YYYY MMM DD - hh:mm A");
};
