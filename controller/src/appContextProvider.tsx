import React, {createContext, Dispatch, ReactElement, SetStateAction, useEffect, useState} from 'react';
//import {clearInterval} from 'timers';
import LoadingSpinner from './LoadingSpinner';
// @ts-ignore
import {v4 as uuidv4} from 'uuid';

type AppControlHandlerProps = {
    addNotification: (element: NotificationCenterElement) => void;

};

interface NotificationCenterElement {
    uid: string;
    text: string;
    status: NotificationCenterElementStatus;
    dismissAt?: number;
}

enum NotificationCenterElementStatus {
    loading,
    notification,
    error,
    success,
}

// @ts-ignore
export const AppControlContext = createContext<AppControlHandlerProps>(null);

// @ts-ignore
const AppControlProvider = ({children}) => {
    const [notificationCenter, setNotificationCenter] = useState<NotificationCenterElement[]>([]);

    var notificationcenterInterval: NodeJS.Timeout;
    var autosaveInterval: NodeJS.Timeout;


    useEffect(() => {
        clearInterval(notificationcenterInterval);
        clearInterval(autosaveInterval);
        notificationcenterInterval = setInterval(() => {
            setNotificationCenter((e) => [
                ...e.filter(
                    (f) => f.dismissAt === undefined || f.dismissAt > Date.now()
                ),
            ]);
        }, 1000);


    }, []);

    function addElementToNotificationCenter(element: NotificationCenterElement) {
        setNotificationCenter((e) => [...e, element]);
    }

    function updateElementInNotificationCenter(
        element: NotificationCenterElement
    ) {
        setNotificationCenter((e) => {
            const index = e.findIndex((f) => f.uid === element.uid);
            if (index > -1) e[index] = element;
            return e;
        });
    }

const state: AppControlHandlerProps = {
    addNotification: addElementToNotificationCenter,
}

return (
    <div className={"h-screen w-screen overflow-hidden dark:text-white bg-gray-100 dark:bg-black"}>


        <div
            className={`flex flex-col h-screen w-screen overflow-hidden `}
        >

            <AppControlContext.Provider value={state}>

                <div className={"h-screen relative overflow-hidden"}>
                    <div className="absolute bottom-6 right-6 flex z-20 text-white flex-col">
                        {notificationCenter.map((notification) => (
                            <div
                                key={notification.uid}
                                className={`m-4 flex flex-row p-3 rounded-lg w-64 justify-between pl-4 ${
                                    notification.status === NotificationCenterElementStatus.error
                                        ? 'bg-red-500'
                                        : `${
                                            notification.status ===
                                            NotificationCenterElementStatus.success
                                                ? 'bg-green-400'
                                                : 'bg-gray-400 dark:bg-gray-600'
                                        }`
                                }`}
                            >
                                <p>{notification.text}</p>
                                {notification.status ===
                                NotificationCenterElementStatus.loading ? (
                                    <div className="w-5 ml-4 mr-2">
                                        <LoadingSpinner color="#ffffff" size={'25'}/>
                                    </div>
                                ) : (
                                    <div/>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className={"h-full"}>
                        {children}
                    </div>
                </div>

            </AppControlContext.Provider>
        </div>
    </div>
);
};

export type {NotificationCenterElement};
export {NotificationCenterElementStatus};
export default AppControlProvider;