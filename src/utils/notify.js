import Swal from 'sweetalert2';

const topToast = Swal.mixin({
    toast: true,
    position: 'top',
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
});

export const notifySuccess = (title) => {
    topToast.fire({ icon: 'success', title });
};

export const notifyError = (title) => {
    topToast.fire({ icon: 'error', title });
};

export const notifyInfo = (title) => {
    topToast.fire({ icon: 'info', title });
};

